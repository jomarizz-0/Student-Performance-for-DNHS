<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {

    // ── READ ──────────────────────────────────────────────────────────────────
    case 'GET':

        if ($action === 'get_students') {
            $search = $_GET['search'] ?? '';
            $baseSQL = "
                SELECT
                    CAST(s.stud_lrn AS CHAR) AS stud_lrn,
                    s.first_name, s.middle_name, s.last_name,
                    s.gender, s.birth_date,
                    s.address_barangay, s.address_municipality,
                    s.class_id, s.adviser_id,
                    cs.grade_level, cs.section_name, cs.school_year,
                    p.first_name  AS adviser_fname,
                    p.last_name   AS adviser_lname,
                    p.position_type AS adviser_position
                FROM student s
                LEFT JOIN class_section cs ON s.class_id  = cs.class_id
                LEFT JOIN personnel    p  ON s.adviser_id = p.personnel_id
            ";
            if ($search) {
                $stmt = $pdo->prepare($baseSQL . "
                    WHERE s.first_name LIKE :s OR s.last_name LIKE :s
                       OR s.middle_name LIKE :s
                       OR s.address_municipality LIKE :s
                       OR s.address_barangay LIKE :s
                       OR cs.section_name LIKE :s
                    ORDER BY s.last_name, s.first_name
                ");
                $stmt->execute([':s' => "%$search%"]);
            } else {
                $stmt = $pdo->query($baseSQL . "ORDER BY s.last_name, s.first_name");
            }
            echo json_encode($stmt->fetchAll());
        }

        elseif ($action === 'get_student') {
            $id = $_GET['id'] ?? null;
            if (!$id) { echo json_encode(['error' => 'No LRN provided']); break; }
            $stmt = $pdo->prepare("
                SELECT s.*,
                    cs.grade_level, cs.section_name, cs.school_year,
                    p.first_name AS adviser_fname, p.last_name AS adviser_lname
                FROM student s
                LEFT JOIN class_section cs ON s.class_id  = cs.class_id
                LEFT JOIN personnel    p  ON s.adviser_id = p.personnel_id
                WHERE s.stud_lrn = ?
            ");
            $stmt->execute([$id]);
            $student = $stmt->fetch();
            echo json_encode($student ?: ['error' => 'Student not found']);
        }

        elseif ($action === 'get_personnel') {
            $stmt = $pdo->query("
                SELECT personnel_id, first_name, last_name, position_type
                FROM personnel
                WHERE position_type IN ('Teacher','Adviser','Head Teacher','Registrar','Guidance Counselor','Librarian','Principal')
                ORDER BY last_name, first_name
            ");
            echo json_encode($stmt->fetchAll());
        }

        elseif ($action === 'get_classes') {
            $stmt = $pdo->query("
                SELECT cs.class_id, cs.grade_level, cs.section_name, cs.school_year,
                       p.first_name AS adviser_fname, p.last_name AS adviser_lname
                FROM class_section cs
                LEFT JOIN personnel p ON cs.adviser_id = p.personnel_id
                ORDER BY cs.grade_level, cs.section_name
            ");
            echo json_encode($stmt->fetchAll());
        }

        elseif ($action === 'get_subjects') {
            $stmt = $pdo->query("SELECT subject_id, subject_name, subject_description FROM subject ORDER BY subject_name");
            echo json_encode($stmt->fetchAll());
        }

        elseif ($action === 'get_grades') {
            $id = $_GET['id'] ?? null;
            if (!$id) { echo json_encode(['error' => 'No LRN provided']); break; }
            $stmt = $pdo->prepare("
                SELECT g.grade_id, g.final_grade, g.remarks, g.subject_id, g.teacher_id,
                       sub.subject_name, sub.subject_description,
                       p.first_name AS teacher_fname, p.last_name AS teacher_lname,
                       GROUP_CONCAT(
                           CONCAT(gd.grading_period, ':', gd.grade_score)
                           ORDER BY gd.grading_period SEPARATOR '|'
                       ) AS period_scores
                FROM grades g
                LEFT JOIN subject sub ON g.subject_id = sub.subject_id
                LEFT JOIN personnel p ON g.teacher_id = p.personnel_id
                LEFT JOIN grade_details gd ON g.grade_id = gd.grade_id
                WHERE g.stud_lrn = ?
                GROUP BY g.grade_id
                ORDER BY sub.subject_name
            ");
            $stmt->execute([$id]);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$row) {
                $periods = [];
                if ($row['period_scores']) {
                    foreach (explode('|', $row['period_scores']) as $entry) {
                        [$period, $score] = explode(':', $entry, 2);
                        $periods[$period] = (float)$score;
                    }
                }
                $row['periods'] = $periods;
                unset($row['period_scores']);
            }
            echo json_encode($rows);
        }

        elseif ($action === 'get_attendance') {
            $id = $_GET['id'] ?? null;
            if (!$id) { echo json_encode(['error' => 'No LRN provided']); break; }
            $stmt = $pdo->prepare("
                SELECT attendance_id, date, status, teacher_id,
                       CONCAT(p.first_name,' ',p.last_name) AS teacher_name
                FROM attendance a
                LEFT JOIN personnel p ON a.teacher_id = p.personnel_id
                WHERE a.stud_lrn = ?
                ORDER BY a.date DESC
            ");
            $stmt->execute([$id]);
            echo json_encode($stmt->fetchAll());
        }

        elseif ($action === 'get_stats') {
            $total   = $pdo->query("SELECT COUNT(*) FROM student")->fetchColumn();
            $male    = $pdo->query("SELECT COUNT(*) FROM student WHERE gender='Male'")->fetchColumn();
            $female  = $pdo->query("SELECT COUNT(*) FROM student WHERE gender='Female'")->fetchColumn();
            $sections= $pdo->query("SELECT COUNT(*) FROM class_section")->fetchColumn();
            echo json_encode([
                'total'    => (int)$total,
                'male'     => (int)$male,
                'female'   => (int)$female,
                'sections' => (int)$sections,
            ]);
        }

        break;

    // ── CREATE ────────────────────────────────────────────────────────────────
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        // ── Add Attendance Record ──
        if ($action === 'add_attendance') {
            $errors = [];
            if (empty($data['stud_lrn']))  $errors[] = "Student LRN is required.";
            if (empty($data['date']))       $errors[] = "Date is required.";
            if (empty($data['status']))     $errors[] = "Status is required.";
            if (empty($data['class_id']))   $errors[] = "Class ID is required.";
            if (empty($data['teacher_id'])) $errors[] = "Teacher is required.";
            if ($errors) { http_response_code(422); echo json_encode(['errors' => $errors]); break; }

            // Check duplicate date for same student
            $chk = $pdo->prepare("SELECT attendance_id FROM attendance WHERE stud_lrn=? AND date=?");
            $chk->execute([$data['stud_lrn'], $data['date']]);
            if ($chk->fetch()) {
                http_response_code(422);
                echo json_encode(['errors' => ['An attendance record for this student on that date already exists.']]);
                break;
            }

            $stmt = $pdo->prepare("INSERT INTO attendance (stud_lrn, class_id, teacher_id, date, status) VALUES (?,?,?,?,?)");
            $stmt->execute([$data['stud_lrn'], $data['class_id'], $data['teacher_id'], $data['date'], $data['status']]);
            echo json_encode(['success' => true, 'message' => 'Attendance record added.']);
            break;
        }

        // ── Add Grade Record ──
        if ($action === 'add_grade') {
            $errors = [];
            if (empty($data['stud_lrn']))   $errors[] = "Student LRN is required.";
            if (empty($data['subject_id'])) $errors[] = "Subject is required.";
            if (empty($data['teacher_id'])) $errors[] = "Teacher is required.";
            if ($errors) { http_response_code(422); echo json_encode(['errors' => $errors]); break; }

            // Check duplicate subject for same student
            $chk = $pdo->prepare("SELECT grade_id FROM grades WHERE stud_lrn=? AND subject_id=?");
            $chk->execute([$data['stud_lrn'], $data['subject_id']]);
            if ($chk->fetch()) {
                http_response_code(422);
                echo json_encode(['errors' => ['A grade record for this subject already exists for this student.']]);
                break;
            }

            $periods = ['1st Quarter','2nd Quarter','3rd Quarter','4th Quarter'];
            $scores  = [];
            foreach ($periods as $p) {
                $key = str_replace(' ','_', strtolower($p));
                if (isset($data[$key]) && $data[$key] !== '') {
                    $scores[$p] = (float)$data[$key];
                }
            }

            // Auto-compute final grade as average of entered quarters
            $final   = count($scores) ? array_sum($scores) / count($scores) : null;
            $remarks = $final !== null ? ($final >= 75 ? 'Passed' : 'Failed') : null;

            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO grades (stud_lrn, subject_id, teacher_id, final_grade, remarks) VALUES (?,?,?,?,?)");
            $stmt->execute([$data['stud_lrn'], $data['subject_id'], $data['teacher_id'], $final, $remarks]);
            $gradeId = $pdo->lastInsertId();

            $det = $pdo->prepare("INSERT INTO grade_details (grade_id, grading_period, grade_score) VALUES (?,?,?)");
            foreach ($scores as $period => $score) {
                $det->execute([$gradeId, $period, $score]);
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Grade record added.']);
            break;
        }

        // ── Add Student (default POST) ──
        $errors = [];
        if (empty(trim($data['stud_lrn']   ?? '')))  $errors[] = "Student LRN is required.";
        if (empty(trim($data['first_name'] ?? '')))  $errors[] = "First name is required.";
        if (empty(trim($data['last_name']  ?? '')))  $errors[] = "Last name is required.";
        if (empty($data['birth_date']      ?? ''))   $errors[] = "Birth date is required.";
        if (empty($data['gender']          ?? ''))   $errors[] = "Gender is required.";
        if (empty($data['class_id']        ?? ''))   $errors[] = "Class/Section is required.";
        if (empty($data['adviser_id']      ?? ''))   $errors[] = "Adviser is required.";

        if ($errors) { http_response_code(422); echo json_encode(['errors' => $errors]); break; }

        $lrn = trim($data['stud_lrn']);
        if (!preg_match('/^\d{1,12}$/', $lrn)) {
            http_response_code(422);
            echo json_encode(['errors' => ['LRN must be numeric (up to 12 digits).']]);
            break;
        }

        $check = $pdo->prepare("SELECT stud_lrn FROM student WHERE stud_lrn = ?");
        $check->execute([$lrn]);
        if ($check->fetch()) {
            http_response_code(422);
            echo json_encode(['errors' => ['LRN already exists.']]);
            break;
        }

        $stmt = $pdo->prepare("
            INSERT INTO student
                (stud_lrn, first_name, middle_name, last_name,
                 gender, birth_date,
                 address_barangay, address_municipality,
                 class_id, adviser_id)
            VALUES
                (:stud_lrn, :first_name, :middle_name, :last_name,
                 :gender, :birth_date,
                 :address_barangay, :address_municipality,
                 :class_id, :adviser_id)
        ");
        $stmt->execute([
            ':stud_lrn'             => $lrn,
            ':first_name'           => trim($data['first_name']),
            ':middle_name'          => trim($data['middle_name'] ?? ''),
            ':last_name'            => trim($data['last_name']),
            ':gender'               => $data['gender'],
            ':birth_date'           => $data['birth_date'],
            ':address_barangay'     => trim($data['address_barangay'] ?? ''),
            ':address_municipality' => trim($data['address_municipality'] ?? ''),
            ':class_id'             => (int)$data['class_id'],
            ':adviser_id'           => (int)$data['adviser_id'],
        ]);
        echo json_encode(['success' => true, 'message' => 'Student added successfully.']);
        break;

    // ── UPDATE ────────────────────────────────────────────────────────────────
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);

        // ── Update Attendance ──
        if ($action === 'update_attendance') {
            $attId = $data['attendance_id'] ?? null;
            if (!$attId) { echo json_encode(['error' => 'No attendance_id provided']); break; }
            $errors = [];
            if (empty($data['date']))       $errors[] = "Date is required.";
            if (empty($data['status']))     $errors[] = "Status is required.";
            if (empty($data['teacher_id'])) $errors[] = "Teacher is required.";
            if ($errors) { http_response_code(422); echo json_encode(['errors' => $errors]); break; }

            $stmt = $pdo->prepare("UPDATE attendance SET date=?, status=?, teacher_id=? WHERE attendance_id=?");
            $stmt->execute([$data['date'], $data['status'], $data['teacher_id'], $attId]);
            echo json_encode(['success' => true, 'message' => 'Attendance updated.']);
            break;
        }

        // ── Update Grade ──
        if ($action === 'update_grade') {
            $gradeId = $data['grade_id'] ?? null;
            if (!$gradeId) { echo json_encode(['error' => 'No grade_id provided']); break; }

            $periods = ['1st Quarter','2nd Quarter','3rd Quarter','4th Quarter'];
            $scores  = [];
            foreach ($periods as $p) {
                $key = str_replace(' ','_', strtolower($p));
                if (isset($data[$key]) && $data[$key] !== '') {
                    $scores[$p] = (float)$data[$key];
                }
            }

            $final   = count($scores) ? array_sum($scores) / count($scores) : null;
            $remarks = $final !== null ? ($final >= 75 ? 'Passed' : 'Failed') : null;

            $pdo->beginTransaction();
            $upd = $pdo->prepare("UPDATE grades SET teacher_id=?, final_grade=?, remarks=? WHERE grade_id=?");
            $upd->execute([$data['teacher_id'], $final, $remarks, $gradeId]);

            // Remove old detail rows and re-insert
            $pdo->prepare("DELETE FROM grade_details WHERE grade_id=?")->execute([$gradeId]);
            $det = $pdo->prepare("INSERT INTO grade_details (grade_id, grading_period, grade_score) VALUES (?,?,?)");
            foreach ($scores as $period => $score) {
                $det->execute([$gradeId, $period, $score]);
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Grade updated.', 'final_grade' => $final, 'remarks' => $remarks]);
            break;
        }

        // ── Update Student (default PUT) ──
        $id = $data['stud_lrn'] ?? null;
        if (!$id) { echo json_encode(['error' => 'No LRN provided']); break; }

        $errors = [];
        if (empty(trim($data['first_name'] ?? ''))) $errors[] = "First name is required.";
        if (empty(trim($data['last_name']  ?? ''))) $errors[] = "Last name is required.";
        if (empty($data['birth_date']      ?? ''))  $errors[] = "Birth date is required.";
        if (empty($data['gender']          ?? ''))  $errors[] = "Gender is required.";
        if (empty($data['class_id']        ?? ''))  $errors[] = "Class/Section is required.";
        if (empty($data['adviser_id']      ?? ''))  $errors[] = "Adviser is required.";

        if ($errors) { http_response_code(422); echo json_encode(['errors' => $errors]); break; }

        $stmt = $pdo->prepare("
            UPDATE student SET
                first_name            = :first_name,
                middle_name           = :middle_name,
                last_name             = :last_name,
                gender                = :gender,
                birth_date            = :birth_date,
                address_barangay      = :address_barangay,
                address_municipality  = :address_municipality,
                class_id              = :class_id,
                adviser_id            = :adviser_id
            WHERE stud_lrn = :id
        ");
        $stmt->execute([
            ':first_name'           => trim($data['first_name']),
            ':middle_name'          => trim($data['middle_name'] ?? ''),
            ':last_name'            => trim($data['last_name']),
            ':gender'               => $data['gender'],
            ':birth_date'           => $data['birth_date'],
            ':address_barangay'     => trim($data['address_barangay'] ?? ''),
            ':address_municipality' => trim($data['address_municipality'] ?? ''),
            ':class_id'             => (int)$data['class_id'],
            ':adviser_id'           => (int)$data['adviser_id'],
            ':id'                   => $id,
        ]);
        echo json_encode(['success' => true, 'message' => 'Student updated successfully.']);
        break;

    // ── DELETE ────────────────────────────────────────────────────────────────
    case 'DELETE':
        $id = $_GET['id'] ?? null;

        // ── Delete Attendance ──
        if ($action === 'delete_attendance') {
            if (!$id) { echo json_encode(['error' => 'No attendance_id provided']); break; }
            $stmt = $pdo->prepare("DELETE FROM attendance WHERE attendance_id = ?");
            $stmt->execute([$id]);
            echo json_encode($stmt->rowCount()
                ? ['success' => true,  'message' => 'Attendance record deleted.']
                : ['error'   => 'Record not found.']);
            break;
        }

        // ── Delete Grade ──
        if ($action === 'delete_grade') {
            if (!$id) { echo json_encode(['error' => 'No grade_id provided']); break; }
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM grade_details WHERE grade_id=?")->execute([$id]);
            $stmt = $pdo->prepare("DELETE FROM grades WHERE grade_id=?");
            $stmt->execute([$id]);
            $pdo->commit();
            echo json_encode($stmt->rowCount()
                ? ['success' => true,  'message' => 'Grade record deleted.']
                : ['error'   => 'Record not found.']);
            break;
        }

        // ── Delete Student ──
        if (!$id) { echo json_encode(['error' => 'No ID provided']); break; }
        $stmt = $pdo->prepare("DELETE FROM student WHERE stud_lrn = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount()) {
            echo json_encode(['success' => true, 'message' => 'Student deleted successfully.']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Student not found.']);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
?>