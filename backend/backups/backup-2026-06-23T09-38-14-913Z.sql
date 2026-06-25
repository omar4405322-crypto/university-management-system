--
-- PostgreSQL database dump
--

\restrict NvMvKYB90RJesCHPrIqTWTdHigpVutZvcIJ98deofjIZ9CjfO54CHOC057UAZiJ

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AdminRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AdminRole" AS ENUM (
    'IT_SUPPORT',
    'REGISTRAR',
    'FINANCE',
    'ACADEMIC_DEAN'
);


ALTER TYPE public."AdminRole" OWNER TO postgres;

--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'EXCUSED'
);


ALTER TYPE public."AttendanceStatus" OWNER TO postgres;

--
-- Name: EnrollmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EnrollmentStatus" AS ENUM (
    'ENROLLED',
    'COMPLETED',
    'WITHDRAWN',
    'FAILED'
);


ALTER TYPE public."EnrollmentStatus" OWNER TO postgres;

--
-- Name: ExamSessionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExamSessionStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ACTIVE',
    'CLOSED',
    'GRADED'
);


ALTER TYPE public."ExamSessionStatus" OWNER TO postgres;

--
-- Name: ExamType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExamType" AS ENUM (
    'MIDTERM',
    'FINAL',
    'QUIZ'
);


ALTER TYPE public."ExamType" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: PaymentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentType" AS ENUM (
    'TUITION',
    'REGISTRATION',
    'LIBRARY',
    'OTHER'
);


ALTER TYPE public."PaymentType" OWNER TO postgres;

--
-- Name: QuestionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QuestionType" AS ENUM (
    'MCQ',
    'TRUE_FALSE',
    'ESSAY',
    'FILE_UPLOAD'
);


ALTER TYPE public."QuestionType" OWNER TO postgres;

--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."RequestStatus" OWNER TO postgres;

--
-- Name: RiskLevel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."RiskLevel" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'DOCTOR',
    'STUDENT',
    'SUPER_ADMIN',
    'COLLEGE_ADMIN',
    'DEPARTMENT_ADMIN',
    'TEACHING_ASSISTANT'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'IN_PROGRESS',
    'SUBMITTED',
    'GRADED',
    'LATE'
);


ALTER TYPE public."SubmissionStatus" OWNER TO postgres;

--
-- Name: TimetableStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TimetableStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


ALTER TYPE public."TimetableStatus" OWNER TO postgres;

--
-- Name: ViolationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ViolationType" AS ENUM (
    'TAB_SWITCH',
    'WINDOW_BLUR',
    'COPY_ATTEMPT',
    'PASTE_ATTEMPT',
    'RIGHT_CLICK',
    'DEVTOOLS_OPEN',
    'FULLSCREEN_EXIT',
    'FOCUS_LOST'
);


ALTER TYPE public."ViolationType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Attendance" (
    id integer NOT NULL,
    "studentId" integer NOT NULL,
    "courseId" integer NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Attendance" OWNER TO postgres;

--
-- Name: Attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Attendance_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Attendance_id_seq" OWNER TO postgres;

--
-- Name: Attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Attendance_id_seq" OWNED BY public."Attendance".id;


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditLog" (
    id integer NOT NULL,
    "userId" integer,
    "userEmail" text,
    "userRole" text,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text,
    details jsonb,
    "ipAddress" text,
    "userAgent" text,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO postgres;

--
-- Name: AuditLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AuditLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AuditLog_id_seq" OWNER TO postgres;

--
-- Name: AuditLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AuditLog_id_seq" OWNED BY public."AuditLog".id;


--
-- Name: College; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."College" (
    id integer NOT NULL,
    name text NOT NULL,
    "nameAr" text,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "descriptionAr" text,
    "logoUrl" text,
    status text DEFAULT 'active'::text NOT NULL
);


ALTER TABLE public."College" OWNER TO postgres;

--
-- Name: College_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."College_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."College_id_seq" OWNER TO postgres;

--
-- Name: College_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."College_id_seq" OWNED BY public."College".id;


--
-- Name: Course; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Course" (
    id integer NOT NULL,
    "courseCode" text NOT NULL,
    name text NOT NULL,
    description text,
    credits integer DEFAULT 3 NOT NULL,
    "maxStudents" integer DEFAULT 30 NOT NULL,
    "doctorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "departmentId" integer,
    semester integer DEFAULT 1 NOT NULL,
    year integer DEFAULT 1 NOT NULL,
    "nameAr" text
);


ALTER TABLE public."Course" OWNER TO postgres;

--
-- Name: Course_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Course_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Course_id_seq" OWNER TO postgres;

--
-- Name: Course_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Course_id_seq" OWNED BY public."Course".id;


--
-- Name: Department; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Department" (
    id integer NOT NULL,
    name text NOT NULL,
    "nameAr" text,
    "collegeId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Department" OWNER TO postgres;

--
-- Name: Department_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Department_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Department_id_seq" OWNER TO postgres;

--
-- Name: Department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Department_id_seq" OWNED BY public."Department".id;


--
-- Name: doctor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.doctor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.doctor_id_seq OWNER TO postgres;

--
-- Name: Doctor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Doctor" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "doctorId" text DEFAULT ('DOC-'::text || lpad((nextval('public.doctor_id_seq'::regclass))::text, 5, '0'::text)) NOT NULL,
    phone text,
    specialty text,
    "departmentId" integer,
    address text,
    bio text,
    "birthDate" timestamp(3) without time zone,
    gender text
);


ALTER TABLE public."Doctor" OWNER TO postgres;

--
-- Name: Doctor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Doctor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Doctor_id_seq" OWNER TO postgres;

--
-- Name: Doctor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Doctor_id_seq" OWNED BY public."Doctor".id;


--
-- Name: Enrollment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Enrollment" (
    id integer NOT NULL,
    "studentId" integer NOT NULL,
    "courseId" integer NOT NULL,
    semester integer NOT NULL,
    "academicYear" integer NOT NULL,
    "finalGrade" double precision,
    status public."EnrollmentStatus" DEFAULT 'ENROLLED'::public."EnrollmentStatus" NOT NULL,
    "enrolledAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Enrollment" OWNER TO postgres;

--
-- Name: Enrollment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Enrollment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Enrollment_id_seq" OWNER TO postgres;

--
-- Name: Enrollment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Enrollment_id_seq" OWNED BY public."Enrollment".id;


--
-- Name: Exam; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Exam" (
    id integer NOT NULL,
    "courseId" integer NOT NULL,
    type public."ExamType" DEFAULT 'MIDTERM'::public."ExamType" NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    room text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Exam" OWNER TO postgres;

--
-- Name: ExamAnswer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExamAnswer" (
    id integer NOT NULL,
    "submissionId" integer NOT NULL,
    "questionId" integer NOT NULL,
    "selectedOption" text,
    "essayText" text,
    "fileUrl" text,
    "fileKey" text,
    score double precision,
    feedback text,
    "isCorrect" boolean,
    "gradedAt" timestamp(3) without time zone
);


ALTER TABLE public."ExamAnswer" OWNER TO postgres;

--
-- Name: ExamAnswer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ExamAnswer_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExamAnswer_id_seq" OWNER TO postgres;

--
-- Name: ExamAnswer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ExamAnswer_id_seq" OWNED BY public."ExamAnswer".id;


--
-- Name: ExamQuestion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExamQuestion" (
    id integer NOT NULL,
    "examSessionId" integer NOT NULL,
    type public."QuestionType" NOT NULL,
    text text NOT NULL,
    "textAr" text,
    points integer DEFAULT 1 NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "optionA" text,
    "optionB" text,
    "optionC" text,
    "optionD" text,
    "correctAnswer" text,
    "maxWords" integer,
    "allowedFileTypes" text
);


ALTER TABLE public."ExamQuestion" OWNER TO postgres;

--
-- Name: ExamQuestion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ExamQuestion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExamQuestion_id_seq" OWNER TO postgres;

--
-- Name: ExamQuestion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ExamQuestion_id_seq" OWNED BY public."ExamQuestion".id;


--
-- Name: ExamSession; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExamSession" (
    id integer NOT NULL,
    "examId" integer NOT NULL,
    "courseId" integer NOT NULL,
    "doctorId" integer NOT NULL,
    title text NOT NULL,
    instructions text,
    "durationMinutes" integer NOT NULL,
    "totalPoints" integer DEFAULT 100 NOT NULL,
    "passingScore" double precision DEFAULT 50 NOT NULL,
    "shuffleQuestions" boolean DEFAULT false NOT NULL,
    "showResultsAfter" boolean DEFAULT true NOT NULL,
    "allowedAttempts" integer DEFAULT 1 NOT NULL,
    status public."ExamSessionStatus" DEFAULT 'DRAFT'::public."ExamSessionStatus" NOT NULL,
    "opensAt" timestamp(3) without time zone,
    "closesAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ExamSession" OWNER TO postgres;

--
-- Name: ExamSession_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ExamSession_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExamSession_id_seq" OWNER TO postgres;

--
-- Name: ExamSession_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ExamSession_id_seq" OWNED BY public."ExamSession".id;


--
-- Name: ExamSubmission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExamSubmission" (
    id integer NOT NULL,
    "examSessionId" integer NOT NULL,
    "studentId" integer NOT NULL,
    status public."SubmissionStatus" DEFAULT 'IN_PROGRESS'::public."SubmissionStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "totalScore" double precision,
    feedback text,
    "violationCount" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."ExamSubmission" OWNER TO postgres;

--
-- Name: ExamSubmission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ExamSubmission_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExamSubmission_id_seq" OWNER TO postgres;

--
-- Name: ExamSubmission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ExamSubmission_id_seq" OWNED BY public."ExamSubmission".id;


--
-- Name: ExamViolation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExamViolation" (
    id integer NOT NULL,
    "submissionId" integer NOT NULL,
    type public."ViolationType" NOT NULL,
    "detectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb
);


ALTER TABLE public."ExamViolation" OWNER TO postgres;

--
-- Name: ExamViolation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ExamViolation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExamViolation_id_seq" OWNER TO postgres;

--
-- Name: ExamViolation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ExamViolation_id_seq" OWNED BY public."ExamViolation".id;


--
-- Name: Exam_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Exam_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Exam_id_seq" OWNER TO postgres;

--
-- Name: Exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Exam_id_seq" OWNED BY public."Exam".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    link text
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Notification_id_seq" OWNER TO postgres;

--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Payment" (
    id integer NOT NULL,
    "studentId" integer NOT NULL,
    amount double precision NOT NULL,
    type public."PaymentType" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    description text,
    "dueDate" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: Payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Payment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Payment_id_seq" OWNER TO postgres;

--
-- Name: Payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Payment_id_seq" OWNED BY public."Payment".id;


--
-- Name: Question; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Question" (
    id integer NOT NULL,
    "quizId" integer NOT NULL,
    text text NOT NULL,
    "optionA" text NOT NULL,
    "optionB" text NOT NULL,
    "optionC" text NOT NULL,
    "optionD" text NOT NULL,
    correct text NOT NULL,
    points integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."Question" OWNER TO postgres;

--
-- Name: Question_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Question_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Question_id_seq" OWNER TO postgres;

--
-- Name: Question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Question_id_seq" OWNED BY public."Question".id;


--
-- Name: Quiz; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Quiz" (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    "courseId" integer NOT NULL,
    "doctorId" integer NOT NULL,
    duration integer NOT NULL,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Quiz" OWNER TO postgres;

--
-- Name: QuizSubmission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."QuizSubmission" (
    id integer NOT NULL,
    "quizId" integer NOT NULL,
    "studentId" integer NOT NULL,
    answers jsonb NOT NULL,
    score double precision,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."QuizSubmission" OWNER TO postgres;

--
-- Name: QuizSubmission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."QuizSubmission_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."QuizSubmission_id_seq" OWNER TO postgres;

--
-- Name: QuizSubmission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."QuizSubmission_id_seq" OWNED BY public."QuizSubmission".id;


--
-- Name: Quiz_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Quiz_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Quiz_id_seq" OWNER TO postgres;

--
-- Name: Quiz_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Quiz_id_seq" OWNED BY public."Quiz".id;


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RefreshToken" (
    id integer NOT NULL,
    token text NOT NULL,
    "userId" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RefreshToken" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RefreshToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RefreshToken_id_seq" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RefreshToken_id_seq" OWNED BY public."RefreshToken".id;


--
-- Name: RegistrationRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RegistrationRequest" (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "departmentId" integer,
    status public."RequestStatus" DEFAULT 'PENDING'::public."RequestStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    phone text,
    "studentId" text,
    year integer,
    "rejectionReason" text
);


ALTER TABLE public."RegistrationRequest" OWNER TO postgres;

--
-- Name: RegistrationRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RegistrationRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RegistrationRequest_id_seq" OWNER TO postgres;

--
-- Name: RegistrationRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RegistrationRequest_id_seq" OWNED BY public."RegistrationRequest".id;


--
-- Name: Schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Schedule" (
    id integer NOT NULL,
    "courseId" integer NOT NULL,
    "dayOfWeek" text NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    room text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistantId" integer
);


ALTER TABLE public."Schedule" OWNER TO postgres;

--
-- Name: Schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Schedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Schedule_id_seq" OWNER TO postgres;

--
-- Name: Schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Schedule_id_seq" OWNED BY public."Schedule".id;


--
-- Name: Student; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Student" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "studentId" text NOT NULL,
    phone text,
    address text,
    "enrolledAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "departmentId" integer,
    bio text,
    "birthDate" timestamp(3) without time zone,
    gender text,
    "isActive" boolean DEFAULT true NOT NULL,
    year integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."Student" OWNER TO postgres;

--
-- Name: StudentSuccessMetric; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."StudentSuccessMetric" (
    id integer NOT NULL,
    "studentId" integer NOT NULL,
    "attendanceRate" double precision DEFAULT 0 NOT NULL,
    "averageQuizScore" double precision DEFAULT 0 NOT NULL,
    "assignmentCompletionRate" double precision DEFAULT 0 NOT NULL,
    "predictedRisk" public."RiskLevel" DEFAULT 'LOW'::public."RiskLevel" NOT NULL,
    "lastCalculated" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StudentSuccessMetric" OWNER TO postgres;

--
-- Name: StudentSuccessMetric_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."StudentSuccessMetric_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."StudentSuccessMetric_id_seq" OWNER TO postgres;

--
-- Name: StudentSuccessMetric_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."StudentSuccessMetric_id_seq" OWNED BY public."StudentSuccessMetric".id;


--
-- Name: Student_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Student_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Student_id_seq" OWNER TO postgres;

--
-- Name: Student_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Student_id_seq" OWNED BY public."Student".id;


--
-- Name: Task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Task" (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "courseId" integer NOT NULL,
    "doctorId" integer NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "maxScore" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Task" OWNER TO postgres;

--
-- Name: TaskSubmission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TaskSubmission" (
    id integer NOT NULL,
    "taskId" integer NOT NULL,
    "studentId" integer NOT NULL,
    "fileUrl" text,
    notes text,
    score double precision,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TaskSubmission" OWNER TO postgres;

--
-- Name: TaskSubmission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TaskSubmission_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TaskSubmission_id_seq" OWNER TO postgres;

--
-- Name: TaskSubmission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TaskSubmission_id_seq" OWNED BY public."TaskSubmission".id;


--
-- Name: Task_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Task_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Task_id_seq" OWNER TO postgres;

--
-- Name: Task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Task_id_seq" OWNED BY public."Task".id;


--
-- Name: TeachingAssistant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TeachingAssistant" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "departmentId" integer,
    specialization text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TeachingAssistant" OWNER TO postgres;

--
-- Name: TeachingAssistant_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TeachingAssistant_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TeachingAssistant_id_seq" OWNER TO postgres;

--
-- Name: TeachingAssistant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TeachingAssistant_id_seq" OWNED BY public."TeachingAssistant".id;


--
-- Name: Timetable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Timetable" (
    id integer NOT NULL,
    "collegeId" integer NOT NULL,
    "departmentId" integer NOT NULL,
    "academicYear" integer NOT NULL,
    semester integer NOT NULL,
    title text NOT NULL,
    description text,
    "scheduleData" jsonb,
    "fileUrl" text,
    status public."TimetableStatus" DEFAULT 'DRAFT'::public."TimetableStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Timetable" OWNER TO postgres;

--
-- Name: Timetable_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Timetable_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Timetable_id_seq" OWNER TO postgres;

--
-- Name: Timetable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Timetable_id_seq" OWNED BY public."Timetable".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'STUDENT'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "adminRole" public."AdminRole",
    "profilePicture" text,
    "collegeId" integer,
    "departmentId" integer,
    "tokenVersion" integer DEFAULT 0 NOT NULL,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "twoFactorSecret" text,
    "managedCollegeId" integer,
    "managedDepartmentId" integer
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Attendance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance" ALTER COLUMN id SET DEFAULT nextval('public."Attendance_id_seq"'::regclass);


--
-- Name: AuditLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog" ALTER COLUMN id SET DEFAULT nextval('public."AuditLog_id_seq"'::regclass);


--
-- Name: College id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."College" ALTER COLUMN id SET DEFAULT nextval('public."College_id_seq"'::regclass);


--
-- Name: Course id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Course" ALTER COLUMN id SET DEFAULT nextval('public."Course_id_seq"'::regclass);


--
-- Name: Department id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Department" ALTER COLUMN id SET DEFAULT nextval('public."Department_id_seq"'::regclass);


--
-- Name: Doctor id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Doctor" ALTER COLUMN id SET DEFAULT nextval('public."Doctor_id_seq"'::regclass);


--
-- Name: Enrollment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Enrollment" ALTER COLUMN id SET DEFAULT nextval('public."Enrollment_id_seq"'::regclass);


--
-- Name: Exam id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Exam" ALTER COLUMN id SET DEFAULT nextval('public."Exam_id_seq"'::regclass);


--
-- Name: ExamAnswer id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamAnswer" ALTER COLUMN id SET DEFAULT nextval('public."ExamAnswer_id_seq"'::regclass);


--
-- Name: ExamQuestion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamQuestion" ALTER COLUMN id SET DEFAULT nextval('public."ExamQuestion_id_seq"'::regclass);


--
-- Name: ExamSession id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSession" ALTER COLUMN id SET DEFAULT nextval('public."ExamSession_id_seq"'::regclass);


--
-- Name: ExamSubmission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSubmission" ALTER COLUMN id SET DEFAULT nextval('public."ExamSubmission_id_seq"'::regclass);


--
-- Name: ExamViolation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamViolation" ALTER COLUMN id SET DEFAULT nextval('public."ExamViolation_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: Payment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment" ALTER COLUMN id SET DEFAULT nextval('public."Payment_id_seq"'::regclass);


--
-- Name: Question id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Question" ALTER COLUMN id SET DEFAULT nextval('public."Question_id_seq"'::regclass);


--
-- Name: Quiz id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quiz" ALTER COLUMN id SET DEFAULT nextval('public."Quiz_id_seq"'::regclass);


--
-- Name: QuizSubmission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuizSubmission" ALTER COLUMN id SET DEFAULT nextval('public."QuizSubmission_id_seq"'::regclass);


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: RegistrationRequest id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegistrationRequest" ALTER COLUMN id SET DEFAULT nextval('public."RegistrationRequest_id_seq"'::regclass);


--
-- Name: Schedule id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Schedule" ALTER COLUMN id SET DEFAULT nextval('public."Schedule_id_seq"'::regclass);


--
-- Name: Student id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student" ALTER COLUMN id SET DEFAULT nextval('public."Student_id_seq"'::regclass);


--
-- Name: StudentSuccessMetric id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StudentSuccessMetric" ALTER COLUMN id SET DEFAULT nextval('public."StudentSuccessMetric_id_seq"'::regclass);


--
-- Name: Task id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task" ALTER COLUMN id SET DEFAULT nextval('public."Task_id_seq"'::regclass);


--
-- Name: TaskSubmission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskSubmission" ALTER COLUMN id SET DEFAULT nextval('public."TaskSubmission_id_seq"'::regclass);


--
-- Name: TeachingAssistant id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeachingAssistant" ALTER COLUMN id SET DEFAULT nextval('public."TeachingAssistant_id_seq"'::regclass);


--
-- Name: Timetable id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Timetable" ALTER COLUMN id SET DEFAULT nextval('public."Timetable_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Attendance" (id, "studentId", "courseId", date, status, remarks, "createdAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditLog" (id, "userId", "userEmail", "userRole", action, entity, "entityId", details, "ipAddress", "userAgent", "timestamp") FROM stdin;
\.


--
-- Data for Name: College; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."College" (id, name, "nameAr", description, "createdAt", "descriptionAr", "logoUrl", status) FROM stdin;
1	College of Industry & Energy	كلية الصناعة والطاقة	Focuses on modern industrial technologies and renewable energy.	2026-06-22 17:47:03.871	\N	\N	active
2	College of Health Sciences	كلية العلوم الصحية	Dedicated to medical and healthcare education.	2026-06-22 17:47:03.877	\N	\N	active
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Course" (id, "courseCode", name, description, credits, "maxStudents", "doctorId", "createdAt", "departmentId", semester, year, "nameAr") FROM stdin;
26	CS101	Introduction to Programming	\N	3	30	1	2026-06-22 21:54:47.621	1	1	1	مقدمة في البرمجة
27	CS201	Data Structures	\N	3	30	2	2026-06-22 21:54:47.624	2	1	2	هياكل البيانات
28	CS301	Algorithms	\N	3	30	3	2026-06-22 21:54:47.625	3	1	3	الخوارزميات
29	MATH201	Linear Algebra	\N	3	30	5	2026-06-22 21:54:47.628	5	2	2	الجبر الخطي
30	ENG201	Academic Writing	\N	2	30	8	2026-06-22 21:54:47.631	8	1	2	الكتابة الأكاديمية
33	BIO101	Biology I	\N	3	30	12	2026-06-22 21:54:47.636	2	2	1	الأحياء 1
34	CHEM101	Chemistry I	\N	3	30	13	2026-06-22 21:54:47.638	3	2	1	الكيمياء 1
35	HIST101	Modern History	\N	2	30	14	2026-06-22 21:54:47.639	4	2	1	التاريخ الحديث
36	ECON101	Microeconomics	\N	3	30	15	2026-06-22 21:54:47.641	5	1	2	الاقتصاد الجزئي
4	ENG101	English Composition I	\N	3	30	1	2026-06-22 17:47:04.097	1	1	1	\N
1	ICT101	Introduction to Programming	\N	3	30	2	2026-06-22 17:47:04.091	1	1	1	\N
3	MATH101	Calculus I	\N	4	30	3	2026-06-22 17:47:04.096	1	1	1	\N
2	ICT102	Computer Architecture	\N	3	30	4	2026-06-22 17:47:04.094	1	1	1	\N
5	PHY101	Physics for Engineers	\N	4	30	5	2026-06-22 17:47:04.098	1	1	1	\N
31	ICT201	Data Structures & Algorithms	\N	3	30	1	2026-06-22 21:54:47.634	1	1	2	أساسيات الشبكات
43	ICT202	Database Systems	\N	3	30	2	2026-06-22 22:04:53.331	1	2	2	\N
32	ICT301	Network Security	\N	3	30	3	2026-06-22 21:54:47.635	1	1	3	أساسيات الأمن السيبراني
45	ICT302	Web Development	\N	3	30	4	2026-06-22 22:04:53.333	1	2	3	\N
46	MECH101	Engineering Mechanics	\N	3	30	6	2026-06-22 22:04:53.334	2	1	1	\N
47	MECH102	Electronics Fundamentals	\N	3	30	7	2026-06-22 22:04:53.335	2	2	1	\N
48	MECH201	Control Systems	\N	3	30	8	2026-06-22 22:04:53.336	2	1	2	\N
49	MECH202	Robotics	\N	3	30	9	2026-06-22 22:04:53.336	2	2	2	\N
50	MECH301	Industrial Automation	\N	3	30	6	2026-06-22 22:04:53.337	2	1	3	\N
51	MECH302	PLC Programming	\N	3	30	7	2026-06-22 22:04:53.338	2	2	3	\N
52	RE101	Solar Energy Fundamentals	\N	3	30	10	2026-06-22 22:04:53.339	3	1	1	\N
53	RE102	Wind Energy Systems	\N	3	30	11	2026-06-22 22:04:53.34	3	2	1	\N
54	RE201	Energy Storage	\N	3	30	12	2026-06-22 22:04:53.34	3	1	2	\N
55	RE202	Smart Grid Systems	\N	3	30	13	2026-06-22 22:04:53.341	3	2	2	\N
56	RE301	Energy Audit	\N	3	30	10	2026-06-22 22:04:53.342	3	1	3	\N
57	RE302	Renewable Energy Projects	\N	3	30	11	2026-06-22 22:04:53.343	3	2	3	\N
58	NUR101	Fundamentals of Nursing	\N	3	30	22	2026-06-22 22:04:53.344	4	1	1	\N
59	NUR102	Anatomy & Physiology	\N	3	30	23	2026-06-22 22:04:53.345	4	2	1	\N
60	NUR201	Medical-Surgical Nursing	\N	3	30	24	2026-06-22 22:04:53.346	4	1	2	\N
61	NUR202	Pediatric Nursing	\N	3	30	25	2026-06-22 22:04:53.347	4	2	2	\N
62	NUR301	Community Health Nursing	\N	3	30	22	2026-06-22 22:04:53.348	4	1	3	\N
63	NUR302	Critical Care Nursing	\N	3	30	23	2026-06-22 22:04:53.349	4	2	3	\N
64	MLT101	Hematology	\N	3	30	26	2026-06-22 22:04:53.35	5	1	1	\N
65	MLT102	Clinical Biochemistry	\N	3	30	27	2026-06-22 22:04:53.35	5	2	1	\N
66	MLT201	Microbiology	\N	3	30	28	2026-06-22 22:04:53.351	5	1	2	\N
67	MLT202	Histology	\N	3	30	26	2026-06-22 22:04:53.352	5	2	2	\N
68	MLT301	Clinical Pathology	\N	3	30	27	2026-06-22 22:04:53.353	5	1	3	\N
69	MLT302	Lab Management	\N	3	30	28	2026-06-22 22:04:53.354	5	2	3	\N
70	RLW101	Railway Engineering Basics	\N	3	30	14	2026-06-22 22:04:53.355	6	1	1	\N
71	RLW102	Track Geometry	\N	3	30	15	2026-06-22 22:04:53.357	6	2	1	\N
72	RLW201	Railway Signaling	\N	3	30	16	2026-06-22 22:04:53.358	6	1	2	\N
73	RLW202	Rolling Stock	\N	3	30	17	2026-06-22 22:04:53.359	6	2	2	\N
74	RLW301	Railway Safety	\N	3	30	261	2026-06-22 22:04:53.361	6	1	3	\N
75	RLW302	Rail Infrastructure	\N	3	30	262	2026-06-22 22:04:53.361	6	2	3	\N
76	AUT101	Automotive Fundamentals	\N	3	30	18	2026-06-22 22:04:53.363	7	1	1	\N
77	AUT102	Engine Technology	\N	3	30	19	2026-06-22 22:04:53.364	7	2	1	\N
78	AUT201	Vehicle Electronics	\N	3	30	20	2026-06-22 22:04:53.365	7	1	2	\N
79	AUT202	Transmission Systems	\N	3	30	21	2026-06-22 22:04:53.365	7	2	2	\N
80	AUT301	Electric Vehicles	\N	3	30	266	2026-06-22 22:04:53.366	7	1	3	\N
81	AUT302	Automotive Diagnostics	\N	3	30	267	2026-06-22 22:04:53.367	7	2	3	\N
82	EMS101	Emergency Care Basics	\N	3	30	34	2026-06-22 22:04:53.368	8	1	1	\N
83	EMS102	First Aid & CPR	\N	3	30	35	2026-06-22 22:04:53.369	8	2	1	\N
84	EMS201	Trauma Management	\N	3	30	36	2026-06-22 22:04:53.37	8	1	2	\N
85	EMS202	Emergency Pharmacology	\N	3	30	37	2026-06-22 22:04:53.371	8	2	2	\N
86	EMS301	Disaster Management	\N	3	30	271	2026-06-22 22:04:53.371	8	1	3	\N
87	EMS302	Advanced Life Support	\N	3	30	272	2026-06-22 22:04:53.372	8	2	3	\N
88	PRO101	Anatomy for P&O	\N	3	30	38	2026-06-22 22:04:53.374	9	1	1	\N
89	PRO102	Biomechanics	\N	3	30	39	2026-06-22 22:04:53.374	9	2	1	\N
90	PRO201	Lower Limb Prosthetics	\N	3	30	40	2026-06-22 22:04:53.375	9	1	2	\N
91	PRO202	Upper Limb Orthotics	\N	3	30	41	2026-06-22 22:04:53.377	9	2	2	\N
92	PRO301	Pediatric P&O	\N	3	30	273	2026-06-22 22:04:53.378	9	1	3	\N
93	PRO302	Advanced Prosthetics	\N	3	30	274	2026-06-22 22:04:53.378	9	2	3	\N
94	RAD101	Radiographic Anatomy	\N	3	30	30	2026-06-22 22:04:53.38	10	1	1	\N
95	RAD102	X-Ray Technology	\N	3	30	31	2026-06-22 22:04:53.381	10	2	1	\N
96	RAD201	CT Scanning	\N	3	30	32	2026-06-22 22:04:53.381	10	1	2	\N
97	RAD202	MRI Fundamentals	\N	3	30	33	2026-06-22 22:04:53.382	10	2	2	\N
98	RAD301	Nuclear Medicine	\N	3	30	278	2026-06-22 22:04:53.383	10	1	3	\N
99	RAD302	Radiation Protection	\N	3	30	279	2026-06-22 22:04:53.384	10	2	3	\N
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Department" (id, name, "nameAr", "collegeId", "createdAt") FROM stdin;
1	Information & Communication Technology	تكنولوجيا المعلومات والاتصالات	1	2026-06-22 17:47:03.879
2	Mechatronics Department	قسم الميكاترونيكس	1	2026-06-22 17:47:03.882
3	Renewable Energy Department	قسم الطاقة المتجددة	1	2026-06-22 17:47:03.884
4	Nursing Department	قسم التمريض	2	2026-06-22 17:47:03.885
5	Medical Labs Department	قسم المختبرات الطبية	2	2026-06-22 17:47:03.886
6	Railway Technology	تكنولوجيا السكك الحديدية	1	2026-06-22 17:47:03.888
7	Automotive Technology	تكنولوجيا السيارات	1	2026-06-22 17:47:03.889
8	Emergency Medical Services	خدمات الطوارئ الطبية	2	2026-06-22 17:47:03.89
9	Prosthetics and Orthotics	الأطراف الصناعية والأجهزة التعويضية	2	2026-06-22 17:47:03.891
10	Radiology	الأشعة	2	2026-06-22 17:47:03.892
\.


--
-- Data for Name: Doctor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Doctor" (id, "userId", "firstName", "lastName", "doctorId", phone, specialty, "departmentId", address, bio, "birthDate", gender) FROM stdin;
2	18	Khaled	Mansour	DOC-1-1	\N	\N	1	\N	\N	\N	\N
3	19	Nadia	Samir	DOC-1-2	\N	\N	1	\N	\N	\N	\N
4	20	Tarek	Fouad	DOC-1-3	\N	\N	1	\N	\N	\N	\N
5	21	Heba	Nasser	DOC-1-4	\N	\N	1	\N	\N	\N	\N
6	24	Youssef	Ibrahim	DOC-2-1	\N	\N	2	\N	\N	\N	\N
7	25	Rania	Khalil	DOC-2-2	\N	\N	2	\N	\N	\N	\N
8	26	Mostafa	Sayed	DOC-2-3	\N	\N	2	\N	\N	\N	\N
9	27	Dina	Wahba	DOC-2-4	\N	\N	2	\N	\N	\N	\N
10	30	Hassan	Ali	DOC-3-1	\N	\N	3	\N	\N	\N	\N
11	31	Mona	Salem	DOC-3-2	\N	\N	3	\N	\N	\N	\N
12	32	Omar	Farouk	DOC-3-3	\N	\N	3	\N	\N	\N	\N
13	33	Salma	Yasser	DOC-3-4	\N	\N	3	\N	\N	\N	\N
14	36	Ahmed	Kamal	DOC-6-1	\N	\N	6	\N	\N	\N	\N
15	37	Tarek	Amin	DOC-6-2	\N	\N	6	\N	\N	\N	\N
16	38	Hoda	Samir	DOC-6-3	\N	\N	6	\N	\N	\N	\N
17	39	Nabil	Fathy	DOC-6-4	\N	\N	6	\N	\N	\N	\N
18	42	Mahmoud	Ezzat	DOC-7-1	\N	\N	7	\N	\N	\N	\N
19	43	Yasser	Sami	DOC-7-2	\N	\N	7	\N	\N	\N	\N
20	44	Fatma	Zahran	DOC-7-3	\N	\N	7	\N	\N	\N	\N
83	3	Industry	Admin	DOC-00001	\N	\N	\N	\N	\N	\N	\N
21	45	Karim	Nabil	DOC-7-4	\N	\N	7	\N	\N	\N	\N
22	48	Amal	Karim	DOC-4-1	\N	\N	4	\N	\N	\N	\N
23	49	Hoda	Selim	DOC-4-2	\N	\N	4	\N	\N	\N	\N
24	50	Marwa	Nabil	DOC-4-3	\N	\N	4	\N	\N	\N	\N
25	51	Samia	Fathy	DOC-4-4	\N	\N	4	\N	\N	\N	\N
85	149	Health	Admin	DOC-00003	\N	\N	\N	\N	\N	\N	\N
26	54	Ehab	Morsi	DOC-5-1	\N	\N	5	\N	\N	\N	\N
27	55	Dalia	Ragab	DOC-5-2	\N	\N	5	\N	\N	\N	\N
28	56	Samir	Lotfy	DOC-5-3	\N	\N	5	\N	\N	\N	\N
29	57	Noha	Adel	DOC-5-4	\N	\N	5	\N	\N	\N	\N
30	60	Ashraf	Zidan	DOC-10-1	\N	\N	10	\N	\N	\N	\N
31	61	Iman	Fouad	DOC-10-2	\N	\N	10	\N	\N	\N	\N
32	62	Wael	Barakat	DOC-10-3	\N	\N	10	\N	\N	\N	\N
33	63	Suzanne	Makram	DOC-10-4	\N	\N	10	\N	\N	\N	\N
34	66	Hany	Gaber	DOC-8-1	\N	\N	8	\N	\N	\N	\N
35	67	Reham	Sobhy	DOC-8-2	\N	\N	8	\N	\N	\N	\N
36	68	Tarek	Osman	DOC-8-3	\N	\N	8	\N	\N	\N	\N
37	69	Mervat	Aziz	DOC-8-4	\N	\N	8	\N	\N	\N	\N
38	72	Adel	Fahmy	DOC-9-1	\N	\N	9	\N	\N	\N	\N
39	73	Shaimaa	Gouda	DOC-9-2	\N	\N	9	\N	\N	\N	\N
40	74	Ramzy	Halim	DOC-9-3	\N	\N	9	\N	\N	\N	\N
41	75	Fatma	Ismail	DOC-9-4	\N	\N	9	\N	\N	\N	\N
261	463	Karim	Saad	DOC-6-463	\N	\N	6	\N	\N	\N	\N
262	464	Walid	Hamdi	DOC-6-464	\N	\N	6	\N	\N	\N	\N
263	465	Noha	Rashad	DOC-6-465	\N	\N	6	\N	\N	\N	\N
264	466	Fares	Galal	DOC-6-466	\N	\N	6	\N	\N	\N	\N
265	467	Iman	Barakat	DOC-6-467	\N	\N	6	\N	\N	\N	\N
266	468	Samer	Adel	DOC-7-468	\N	\N	7	\N	\N	\N	\N
267	469	Reem	Khalifa	DOC-7-469	\N	\N	7	\N	\N	\N	\N
268	470	Tamer	Sobhi	DOC-7-470	\N	\N	7	\N	\N	\N	\N
269	471	Doaa	Mansour	DOC-7-471	\N	\N	7	\N	\N	\N	\N
270	472	Nabil	Ezz	DOC-7-472	\N	\N	7	\N	\N	\N	\N
271	473	Wael	Hafez	DOC-8-473	\N	\N	8	\N	\N	\N	\N
272	474	Amira	Sadek	DOC-8-474	\N	\N	8	\N	\N	\N	\N
273	475	Sherif	Anwar	DOC-9-475	\N	\N	9	\N	\N	\N	\N
274	476	Lobna	Gamal	DOC-9-476	\N	\N	9	\N	\N	\N	\N
275	477	Adel	Kamal	DOC-9-477	\N	\N	9	\N	\N	\N	\N
276	478	Maha	Salah	DOC-9-478	\N	\N	9	\N	\N	\N	\N
277	479	Ziad	Fawzy	DOC-9-479	\N	\N	9	\N	\N	\N	\N
278	480	Ghada	Nour	DOC-10-480	\N	\N	10	\N	\N	\N	\N
86	150	Industry	Admin	DOC-00004	\N	\N	\N	\N	\N	\N	\N
1	12	Ahmed	Ali	DOC20260001	\N	\N	1	\N	\N	\N	\N
279	481	Bassem	Ramzy	DOC-10-481	\N	\N	10	\N	\N	\N	\N
280	482	Donia	Mahmoud	DOC-10-482	\N	\N	10	\N	\N	\N	\N
\.


--
-- Data for Name: Enrollment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Enrollment" (id, "studentId", "courseId", semester, "academicYear", "finalGrade", status, "enrolledAt") FROM stdin;
1	1	1	1	1	\N	ENROLLED	2026-06-22 17:47:04.181
2	1	2	1	1	\N	ENROLLED	2026-06-22 17:47:04.184
3	1	3	1	1	\N	ENROLLED	2026-06-22 17:47:04.186
4	1	4	1	1	\N	ENROLLED	2026-06-22 17:47:04.187
5	1	5	1	1	\N	ENROLLED	2026-06-22 17:47:04.188
6	6	26	1	2024	\N	ENROLLED	2026-06-22 21:54:47.642
7	6	27	1	2024	\N	ENROLLED	2026-06-22 21:54:47.644
8	6	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.645
9	6	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.646
10	7	27	1	2024	\N	ENROLLED	2026-06-22 21:54:47.647
11	7	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.648
12	7	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.65
13	7	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.651
14	8	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.652
15	8	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.653
16	8	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.655
17	8	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.656
18	9	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.657
19	9	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.658
20	9	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.659
21	9	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.66
22	10	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.661
23	10	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.662
24	10	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.663
25	10	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.664
26	11	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.665
27	11	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.666
28	11	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.667
29	11	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.668
30	12	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.669
31	12	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.671
32	12	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.672
33	12	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.673
34	13	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.675
35	13	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.676
36	13	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.677
37	13	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.678
38	14	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.679
39	14	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.68
40	14	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.682
41	14	33	1	2024	\N	ENROLLED	2026-06-22 21:54:47.683
42	15	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.684
43	15	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.685
44	15	33	1	2024	\N	ENROLLED	2026-06-22 21:54:47.686
45	15	34	1	2024	\N	ENROLLED	2026-06-22 21:54:47.687
46	16	26	1	2024	\N	ENROLLED	2026-06-22 21:54:47.689
47	16	27	1	2024	\N	ENROLLED	2026-06-22 21:54:47.69
48	16	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.692
49	16	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.693
50	17	27	1	2024	\N	ENROLLED	2026-06-22 21:54:47.694
51	17	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.695
52	17	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.696
53	17	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.697
54	18	28	1	2024	\N	ENROLLED	2026-06-22 21:54:47.699
55	18	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.7
56	18	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.701
57	18	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.702
58	19	3	1	2024	\N	ENROLLED	2026-06-22 21:54:47.704
59	19	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.706
60	19	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.707
61	19	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.708
62	20	29	1	2024	\N	ENROLLED	2026-06-22 21:54:47.709
63	20	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.71
64	20	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.711
65	20	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.712
66	21	5	1	2024	\N	ENROLLED	2026-06-22 21:54:47.713
67	21	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.714
68	21	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.715
69	21	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.716
70	22	4	1	2024	\N	ENROLLED	2026-06-22 21:54:47.717
71	22	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.718
72	22	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.719
73	22	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.721
74	23	30	1	2024	\N	ENROLLED	2026-06-22 21:54:47.722
75	23	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.724
76	23	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.725
77	23	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.726
78	24	1	1	2024	\N	ENROLLED	2026-06-22 21:54:47.727
79	24	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.728
80	24	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.729
81	24	33	1	2024	\N	ENROLLED	2026-06-22 21:54:47.73
82	25	31	1	2024	\N	ENROLLED	2026-06-22 21:54:47.732
83	25	32	1	2024	\N	ENROLLED	2026-06-22 21:54:47.733
84	25	33	1	2024	\N	ENROLLED	2026-06-22 21:54:47.734
85	25	34	1	2024	\N	ENROLLED	2026-06-22 21:54:47.736
86	1	26	1	1	\N	ENROLLED	2026-06-22 22:04:52.975
87	1	32	1	1	\N	ENROLLED	2026-06-22 22:04:52.978
88	27	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.446
89	27	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.447
90	27	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.448
91	27	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.449
92	27	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.451
93	27	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.452
94	27	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.453
95	27	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.454
96	27	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.455
97	27	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.456
98	28	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.46
99	28	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.461
100	28	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.462
101	28	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.463
102	28	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.464
103	28	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.466
104	28	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.467
105	28	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.468
106	28	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.469
107	28	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.47
108	29	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.473
109	29	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.474
110	29	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.475
111	29	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.476
112	29	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.478
113	29	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.479
114	29	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.48
115	29	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.481
116	29	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.482
117	29	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.483
118	30	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.486
119	30	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.487
120	30	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.488
121	30	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.489
122	30	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.49
123	30	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.491
124	30	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.493
125	30	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.495
126	30	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.496
127	30	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.497
128	31	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.5
129	31	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.501
130	31	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.504
131	31	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.506
132	31	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.507
133	31	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.508
134	31	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.51
135	31	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.511
136	31	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.512
137	31	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.513
138	32	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.517
139	32	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.518
140	32	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.519
141	32	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.52
142	32	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.521
143	32	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.522
144	32	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.523
145	32	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.524
146	32	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.526
147	32	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.528
148	33	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.532
149	33	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.533
150	33	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.534
151	33	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.535
152	33	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.536
153	33	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.537
154	33	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.538
155	33	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.539
156	33	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.54
157	33	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.541
158	34	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.545
159	34	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.547
160	34	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.548
161	34	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.549
162	34	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.55
163	34	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.551
164	34	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.552
165	34	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.553
166	34	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.554
167	34	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.555
168	35	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.559
169	35	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.56
170	35	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.561
171	35	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.562
172	35	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.564
173	35	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.565
174	35	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.566
175	35	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.567
176	35	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.568
177	35	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.569
178	36	26	1	2024	\N	ENROLLED	2026-06-22 22:04:53.572
179	36	4	1	2024	\N	ENROLLED	2026-06-22 22:04:53.573
180	36	1	1	2024	\N	ENROLLED	2026-06-22 22:04:53.574
181	36	3	1	2024	\N	ENROLLED	2026-06-22 22:04:53.575
182	36	2	1	2024	\N	ENROLLED	2026-06-22 22:04:53.577
183	36	5	1	2024	\N	ENROLLED	2026-06-22 22:04:53.578
184	36	31	1	2024	\N	ENROLLED	2026-06-22 22:04:53.579
185	36	43	1	2024	\N	ENROLLED	2026-06-22 22:04:53.58
186	36	32	1	2024	\N	ENROLLED	2026-06-22 22:04:53.581
187	36	45	1	2024	\N	ENROLLED	2026-06-22 22:04:53.582
188	37	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.586
189	37	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.587
190	37	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.588
191	37	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.589
192	37	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.59
193	37	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.591
194	37	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.593
195	37	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.595
196	38	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.598
197	38	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.599
198	38	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.6
199	38	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.601
200	38	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.602
201	38	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.603
202	38	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.604
203	38	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.605
204	39	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.608
205	39	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.61
206	39	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.611
207	39	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.612
208	39	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.613
209	39	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.614
210	39	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.615
211	39	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.617
212	40	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.62
213	40	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.621
214	40	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.622
215	40	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.623
216	40	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.624
217	40	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.625
218	40	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.627
219	40	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.628
220	41	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.632
221	41	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.633
222	41	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.634
223	41	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.635
224	41	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.637
225	41	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.638
226	41	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.639
227	41	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.64
228	42	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.644
229	42	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.645
230	42	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.646
231	42	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.647
232	42	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.648
233	42	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.649
234	42	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.65
235	42	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.651
236	43	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.654
237	43	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.655
238	43	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.656
239	43	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.657
240	43	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.659
241	43	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.661
242	43	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.662
243	43	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.663
244	44	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.666
245	44	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.667
246	44	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.668
247	44	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.669
248	44	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.671
249	44	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.672
250	44	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.673
251	44	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.674
252	45	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.678
253	45	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.679
254	45	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.681
255	45	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.682
256	45	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.683
257	45	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.684
258	45	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.685
259	45	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.686
260	46	27	1	2024	\N	ENROLLED	2026-06-22 22:04:53.689
261	46	33	1	2024	\N	ENROLLED	2026-06-22 22:04:53.69
262	46	46	1	2024	\N	ENROLLED	2026-06-22 22:04:53.691
263	46	47	1	2024	\N	ENROLLED	2026-06-22 22:04:53.693
264	46	48	1	2024	\N	ENROLLED	2026-06-22 22:04:53.694
265	46	49	1	2024	\N	ENROLLED	2026-06-22 22:04:53.695
266	46	50	1	2024	\N	ENROLLED	2026-06-22 22:04:53.697
267	46	51	1	2024	\N	ENROLLED	2026-06-22 22:04:53.698
268	47	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.703
269	47	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.704
270	47	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.705
271	47	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.706
272	47	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.707
273	47	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.709
274	47	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.711
275	47	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.712
276	48	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.715
277	48	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.716
278	48	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.718
279	48	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.719
280	48	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.72
281	48	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.721
282	48	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.722
283	48	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.724
284	49	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.728
285	49	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.73
286	49	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.731
287	49	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.732
288	49	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.733
289	49	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.734
290	49	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.735
291	49	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.736
292	50	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.739
293	50	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.74
294	50	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.741
295	50	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.743
296	50	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.745
297	50	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.746
298	50	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.747
299	50	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.748
300	51	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.751
301	51	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.752
302	51	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.753
303	51	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.754
304	51	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.755
305	51	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.756
306	51	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.758
307	51	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.759
308	52	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.764
309	52	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.766
310	52	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.768
311	52	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.769
312	52	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.77
313	52	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.771
314	52	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.772
315	52	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.773
316	53	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.777
317	53	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.779
318	53	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.78
319	53	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.782
320	53	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.783
321	53	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.784
322	53	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.786
323	53	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.787
324	54	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.79
325	54	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.791
326	54	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.793
327	54	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.795
328	54	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.796
329	54	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.797
330	54	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.798
331	54	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.799
332	55	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.802
333	55	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.803
334	55	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.804
335	55	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.806
336	55	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.807
337	55	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.808
338	55	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.809
339	55	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.811
340	56	28	1	2024	\N	ENROLLED	2026-06-22 22:04:53.815
341	56	34	1	2024	\N	ENROLLED	2026-06-22 22:04:53.816
342	56	52	1	2024	\N	ENROLLED	2026-06-22 22:04:53.817
343	56	53	1	2024	\N	ENROLLED	2026-06-22 22:04:53.818
344	56	54	1	2024	\N	ENROLLED	2026-06-22 22:04:53.819
345	56	55	1	2024	\N	ENROLLED	2026-06-22 22:04:53.82
346	56	56	1	2024	\N	ENROLLED	2026-06-22 22:04:53.821
347	56	57	1	2024	\N	ENROLLED	2026-06-22 22:04:53.822
348	57	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.829
349	57	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.831
350	57	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.832
351	57	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.833
352	57	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.834
353	57	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.835
354	57	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.836
355	58	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.839
356	58	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.84
357	58	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.841
358	58	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.843
359	58	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.845
360	58	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.846
361	58	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.847
362	59	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.851
363	59	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.852
364	59	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.853
365	59	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.855
366	59	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.856
367	59	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.858
368	59	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.86
369	60	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.864
370	60	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.865
371	60	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.867
372	60	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.868
373	60	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.869
374	60	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.87
375	60	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.871
376	61	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.874
377	61	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.876
378	61	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.878
379	61	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.879
380	61	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.88
381	61	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.881
382	61	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.882
383	62	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.885
384	62	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.886
385	62	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.887
386	62	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.888
387	62	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.89
388	62	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.891
389	62	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.892
390	63	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.896
391	63	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.897
392	63	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.899
393	63	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.9
394	63	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.901
395	63	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.902
396	63	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.903
397	64	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.906
398	64	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.907
399	64	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.909
400	64	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.911
401	64	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.912
402	64	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.913
403	64	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.914
404	65	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.917
405	65	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.918
406	65	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.92
407	65	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.921
408	65	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.922
409	65	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.923
410	65	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.925
411	66	35	1	2024	\N	ENROLLED	2026-06-22 22:04:53.93
412	66	58	1	2024	\N	ENROLLED	2026-06-22 22:04:53.932
413	66	59	1	2024	\N	ENROLLED	2026-06-22 22:04:53.933
414	66	60	1	2024	\N	ENROLLED	2026-06-22 22:04:53.934
415	66	61	1	2024	\N	ENROLLED	2026-06-22 22:04:53.935
416	66	62	1	2024	\N	ENROLLED	2026-06-22 22:04:53.936
417	66	63	1	2024	\N	ENROLLED	2026-06-22 22:04:53.937
418	67	29	1	2024	\N	ENROLLED	2026-06-22 22:04:53.941
419	67	36	1	2024	\N	ENROLLED	2026-06-22 22:04:53.943
420	67	64	1	2024	\N	ENROLLED	2026-06-22 22:04:53.944
421	67	65	1	2024	\N	ENROLLED	2026-06-22 22:04:53.945
422	67	66	1	2024	\N	ENROLLED	2026-06-22 22:04:53.946
423	67	67	1	2024	\N	ENROLLED	2026-06-22 22:04:53.948
424	67	68	1	2024	\N	ENROLLED	2026-06-22 22:04:53.949
425	67	69	1	2024	\N	ENROLLED	2026-06-22 22:04:53.95
426	68	29	1	2024	\N	ENROLLED	2026-06-22 22:04:53.953
427	68	36	1	2024	\N	ENROLLED	2026-06-22 22:04:53.954
428	68	64	1	2024	\N	ENROLLED	2026-06-22 22:04:53.955
429	68	65	1	2024	\N	ENROLLED	2026-06-22 22:04:53.956
430	68	66	1	2024	\N	ENROLLED	2026-06-22 22:04:53.958
431	68	67	1	2024	\N	ENROLLED	2026-06-22 22:04:53.959
432	68	68	1	2024	\N	ENROLLED	2026-06-22 22:04:53.961
433	68	69	1	2024	\N	ENROLLED	2026-06-22 22:04:53.962
434	69	29	1	2024	\N	ENROLLED	2026-06-22 22:04:53.968
435	69	36	1	2024	\N	ENROLLED	2026-06-22 22:04:53.969
436	69	64	1	2024	\N	ENROLLED	2026-06-22 22:04:53.97
437	69	65	1	2024	\N	ENROLLED	2026-06-22 22:04:53.971
438	69	66	1	2024	\N	ENROLLED	2026-06-22 22:04:53.973
439	69	67	1	2024	\N	ENROLLED	2026-06-22 22:04:53.974
440	69	68	1	2024	\N	ENROLLED	2026-06-22 22:04:53.975
441	69	69	1	2024	\N	ENROLLED	2026-06-22 22:04:53.977
442	70	29	1	2024	\N	ENROLLED	2026-06-22 22:04:53.98
443	70	36	1	2024	\N	ENROLLED	2026-06-22 22:04:53.982
444	70	64	1	2024	\N	ENROLLED	2026-06-22 22:04:53.983
445	70	65	1	2024	\N	ENROLLED	2026-06-22 22:04:53.984
446	70	66	1	2024	\N	ENROLLED	2026-06-22 22:04:53.985
447	70	67	1	2024	\N	ENROLLED	2026-06-22 22:04:53.986
448	70	68	1	2024	\N	ENROLLED	2026-06-22 22:04:53.987
449	70	69	1	2024	\N	ENROLLED	2026-06-22 22:04:53.989
450	71	29	1	2024	\N	ENROLLED	2026-06-22 22:04:53.992
451	71	36	1	2024	\N	ENROLLED	2026-06-22 22:04:53.994
452	71	64	1	2024	\N	ENROLLED	2026-06-22 22:04:53.995
453	71	65	1	2024	\N	ENROLLED	2026-06-22 22:04:53.997
454	71	66	1	2024	\N	ENROLLED	2026-06-22 22:04:53.998
455	71	67	1	2024	\N	ENROLLED	2026-06-22 22:04:53.999
456	71	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54
457	71	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.001
458	72	29	1	2024	\N	ENROLLED	2026-06-22 22:04:54.004
459	72	36	1	2024	\N	ENROLLED	2026-06-22 22:04:54.006
460	72	64	1	2024	\N	ENROLLED	2026-06-22 22:04:54.007
461	72	65	1	2024	\N	ENROLLED	2026-06-22 22:04:54.008
462	72	66	1	2024	\N	ENROLLED	2026-06-22 22:04:54.009
463	72	67	1	2024	\N	ENROLLED	2026-06-22 22:04:54.011
464	72	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54.012
465	72	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.013
466	73	29	1	2024	\N	ENROLLED	2026-06-22 22:04:54.017
467	73	36	1	2024	\N	ENROLLED	2026-06-22 22:04:54.018
468	73	64	1	2024	\N	ENROLLED	2026-06-22 22:04:54.019
469	73	65	1	2024	\N	ENROLLED	2026-06-22 22:04:54.02
470	73	66	1	2024	\N	ENROLLED	2026-06-22 22:04:54.021
471	73	67	1	2024	\N	ENROLLED	2026-06-22 22:04:54.022
472	73	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54.023
473	73	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.024
474	74	29	1	2024	\N	ENROLLED	2026-06-22 22:04:54.028
475	74	36	1	2024	\N	ENROLLED	2026-06-22 22:04:54.03
476	74	64	1	2024	\N	ENROLLED	2026-06-22 22:04:54.031
477	74	65	1	2024	\N	ENROLLED	2026-06-22 22:04:54.032
478	74	66	1	2024	\N	ENROLLED	2026-06-22 22:04:54.033
479	74	67	1	2024	\N	ENROLLED	2026-06-22 22:04:54.034
480	74	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54.035
481	74	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.037
482	75	29	1	2024	\N	ENROLLED	2026-06-22 22:04:54.04
483	75	36	1	2024	\N	ENROLLED	2026-06-22 22:04:54.041
484	75	64	1	2024	\N	ENROLLED	2026-06-22 22:04:54.043
485	75	65	1	2024	\N	ENROLLED	2026-06-22 22:04:54.044
486	75	66	1	2024	\N	ENROLLED	2026-06-22 22:04:54.046
487	75	67	1	2024	\N	ENROLLED	2026-06-22 22:04:54.047
488	75	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54.048
489	75	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.049
490	76	29	1	2024	\N	ENROLLED	2026-06-22 22:04:54.052
491	76	36	1	2024	\N	ENROLLED	2026-06-22 22:04:54.053
492	76	64	1	2024	\N	ENROLLED	2026-06-22 22:04:54.054
493	76	65	1	2024	\N	ENROLLED	2026-06-22 22:04:54.055
494	76	66	1	2024	\N	ENROLLED	2026-06-22 22:04:54.056
495	76	67	1	2024	\N	ENROLLED	2026-06-22 22:04:54.057
496	76	68	1	2024	\N	ENROLLED	2026-06-22 22:04:54.058
497	76	69	1	2024	\N	ENROLLED	2026-06-22 22:04:54.06
498	77	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.064
499	77	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.065
500	77	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.066
501	77	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.067
502	77	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.068
503	77	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.069
504	78	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.072
505	78	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.073
506	78	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.075
507	78	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.077
508	78	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.078
509	78	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.079
510	79	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.082
511	79	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.083
512	79	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.085
513	79	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.086
514	79	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.087
515	79	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.088
516	80	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.091
517	80	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.093
518	80	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.095
519	80	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.096
520	80	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.097
521	80	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.098
522	81	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.101
523	81	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.102
524	81	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.103
525	81	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.104
526	81	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.105
527	81	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.107
528	82	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.111
529	82	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.112
530	82	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.113
531	82	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.114
532	82	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.115
533	82	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.116
534	83	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.12
535	83	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.121
536	83	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.122
537	83	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.123
538	83	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.124
539	83	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.126
540	84	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.13
541	84	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.131
542	84	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.132
543	84	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.133
544	84	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.134
545	84	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.135
546	85	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.139
547	85	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.14
548	85	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.141
549	85	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.142
550	85	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.144
551	85	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.145
552	86	70	1	2024	\N	ENROLLED	2026-06-22 22:04:54.148
553	86	71	1	2024	\N	ENROLLED	2026-06-22 22:04:54.149
554	86	72	1	2024	\N	ENROLLED	2026-06-22 22:04:54.151
555	86	73	1	2024	\N	ENROLLED	2026-06-22 22:04:54.152
556	86	74	1	2024	\N	ENROLLED	2026-06-22 22:04:54.153
557	86	75	1	2024	\N	ENROLLED	2026-06-22 22:04:54.154
558	87	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.157
559	87	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.159
560	87	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.16
561	87	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.162
562	87	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.163
563	87	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.164
564	88	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.167
565	88	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.169
566	88	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.17
567	88	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.171
568	88	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.172
569	88	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.173
570	89	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.178
571	89	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.179
572	89	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.18
573	89	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.182
574	89	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.183
575	89	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.184
576	90	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.187
577	90	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.188
578	90	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.189
579	90	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.19
580	90	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.192
581	90	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.194
582	91	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.197
583	91	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.198
584	91	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.199
585	91	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.2
586	91	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.201
587	91	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.202
588	92	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.206
589	92	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.207
590	92	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.208
591	92	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.21
592	92	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.211
593	92	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.213
594	93	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.216
595	93	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.217
596	93	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.218
597	93	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.219
598	93	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.22
599	93	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.222
600	94	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.225
601	94	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.227
602	94	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.228
603	94	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.229
604	94	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.231
605	94	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.232
606	95	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.235
607	95	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.236
608	95	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.238
609	95	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.239
610	95	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.24
611	95	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.241
612	96	76	1	2024	\N	ENROLLED	2026-06-22 22:04:54.246
613	96	77	1	2024	\N	ENROLLED	2026-06-22 22:04:54.247
614	96	78	1	2024	\N	ENROLLED	2026-06-22 22:04:54.248
615	96	79	1	2024	\N	ENROLLED	2026-06-22 22:04:54.249
616	96	80	1	2024	\N	ENROLLED	2026-06-22 22:04:54.25
617	96	81	1	2024	\N	ENROLLED	2026-06-22 22:04:54.251
618	97	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.254
619	97	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.256
620	97	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.257
621	97	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.258
622	97	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.259
623	97	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.261
624	97	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.262
625	98	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.265
626	98	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.267
627	98	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.268
628	98	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.269
629	98	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.27
630	98	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.271
631	98	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.272
632	99	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.275
633	99	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.276
634	99	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.278
635	99	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.279
636	99	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.281
637	99	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.282
638	99	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.283
639	100	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.287
640	100	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.288
641	100	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.289
642	100	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.29
643	100	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.291
644	100	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.293
645	100	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.295
646	101	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.298
647	101	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.299
648	101	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.3
649	101	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.301
650	101	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.302
651	101	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.303
652	101	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.304
653	102	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.307
654	102	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.309
655	102	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.31
656	102	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.312
657	102	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.313
658	102	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.314
659	102	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.315
660	103	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.318
661	103	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.319
662	103	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.32
663	103	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.321
664	103	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.322
665	103	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.323
666	103	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.324
667	104	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.329
668	104	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.33
669	104	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.331
670	104	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.332
671	104	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.333
672	104	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.334
673	104	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.335
674	105	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.338
675	105	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.34
676	105	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.341
677	105	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.342
678	105	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.344
679	105	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.345
680	105	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.346
681	106	30	1	2024	\N	ENROLLED	2026-06-22 22:04:54.349
682	106	82	1	2024	\N	ENROLLED	2026-06-22 22:04:54.351
683	106	83	1	2024	\N	ENROLLED	2026-06-22 22:04:54.352
684	106	84	1	2024	\N	ENROLLED	2026-06-22 22:04:54.353
685	106	85	1	2024	\N	ENROLLED	2026-06-22 22:04:54.354
686	106	86	1	2024	\N	ENROLLED	2026-06-22 22:04:54.355
687	106	87	1	2024	\N	ENROLLED	2026-06-22 22:04:54.356
688	107	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.361
689	107	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.362
690	107	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.363
691	107	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.364
692	107	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.365
693	107	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.366
694	108	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.369
695	108	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.371
696	108	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.372
697	108	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.373
698	108	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.374
699	108	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.375
700	109	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.379
701	109	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.38
702	109	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.381
703	109	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.382
704	109	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.383
705	109	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.384
706	110	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.388
707	110	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.389
708	110	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.39
709	110	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.391
710	110	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.393
711	110	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.394
712	111	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.397
713	111	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.399
714	111	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.4
715	111	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.401
716	111	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.402
717	111	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.403
718	112	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.406
719	112	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.407
720	112	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.409
721	112	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.411
722	112	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.412
723	112	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.413
724	113	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.416
725	113	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.417
726	113	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.419
727	113	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.42
728	113	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.421
729	113	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.422
730	114	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.425
731	114	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.427
732	114	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.428
733	114	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.429
734	114	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.43
735	114	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.432
736	115	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.435
737	115	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.436
738	115	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.437
739	115	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.439
740	115	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.44
741	115	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.441
742	116	88	1	2024	\N	ENROLLED	2026-06-22 22:04:54.445
743	116	89	1	2024	\N	ENROLLED	2026-06-22 22:04:54.446
744	116	90	1	2024	\N	ENROLLED	2026-06-22 22:04:54.448
745	116	91	1	2024	\N	ENROLLED	2026-06-22 22:04:54.449
746	116	92	1	2024	\N	ENROLLED	2026-06-22 22:04:54.45
747	116	93	1	2024	\N	ENROLLED	2026-06-22 22:04:54.451
748	117	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.455
749	117	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.456
750	117	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.457
751	117	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.458
752	117	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.46
753	117	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.461
754	118	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.465
755	118	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.466
756	118	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.467
757	118	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.468
758	118	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.469
759	118	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.47
760	119	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.473
761	119	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.474
762	119	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.476
763	119	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.478
764	119	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.479
765	119	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.48
766	120	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.484
767	120	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.485
768	120	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.486
769	120	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.487
770	120	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.489
771	120	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.49
772	121	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.495
773	121	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.496
774	121	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.497
775	121	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.499
776	121	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.5
777	121	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.501
778	122	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.505
779	122	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.506
780	122	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.507
781	122	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.508
782	122	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.51
783	122	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.512
784	123	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.515
785	123	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.516
786	123	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.517
787	123	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.518
788	123	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.519
789	123	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.521
790	124	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.524
791	124	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.525
792	124	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.527
793	124	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.529
794	124	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.53
795	124	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.531
796	125	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.535
797	125	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.536
798	125	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.537
799	125	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.538
800	125	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.54
801	125	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.541
802	126	94	1	2024	\N	ENROLLED	2026-06-22 22:04:54.545
803	126	95	1	2024	\N	ENROLLED	2026-06-22 22:04:54.546
804	126	96	1	2024	\N	ENROLLED	2026-06-22 22:04:54.547
805	126	97	1	2024	\N	ENROLLED	2026-06-22 22:04:54.548
806	126	98	1	2024	\N	ENROLLED	2026-06-22 22:04:54.549
807	126	99	1	2024	\N	ENROLLED	2026-06-22 22:04:54.55
\.


--
-- Data for Name: Exam; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Exam" (id, "courseId", type, date, "startTime", "endTime", room, "createdAt") FROM stdin;
1	26	MIDTERM	2026-07-01 00:00:00	09:00	11:00	Hall A	2026-06-22 21:54:47.738
2	27	FINAL	2026-07-08 00:00:00	09:00	11:00	Hall B	2026-06-22 21:54:47.741
3	28	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Room 101	2026-06-22 21:54:47.742
4	3	FINAL	2026-07-22 00:00:00	09:00	11:00	Room 201	2026-06-22 21:54:47.742
5	29	MIDTERM	2026-07-29 00:00:00	09:00	11:00	Lab 1	2026-06-22 21:54:47.743
6	5	FINAL	2026-08-05 00:00:00	09:00	11:00	Hall A	2026-06-22 21:54:47.744
7	4	MIDTERM	2026-08-12 00:00:00	09:00	11:00	Hall B	2026-06-22 21:54:47.744
8	30	FINAL	2026-08-19 00:00:00	09:00	11:00	Room 101	2026-06-22 21:54:47.745
9	1	MIDTERM	2026-08-26 00:00:00	09:00	11:00	Room 201	2026-06-22 21:54:47.746
10	31	FINAL	2026-09-02 00:00:00	09:00	11:00	Lab 1	2026-06-22 21:54:47.746
11	1	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall A	2026-06-22 22:04:54.641
12	1	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall A	2026-06-22 22:04:54.643
13	27	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall B	2026-06-22 22:04:54.644
14	27	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall B	2026-06-22 22:04:54.645
15	28	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall C	2026-06-22 22:04:54.645
16	28	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall C	2026-06-22 22:04:54.646
17	35	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall D	2026-06-22 22:04:54.647
18	35	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall D	2026-06-22 22:04:54.647
19	29	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall E	2026-06-22 22:04:54.648
20	29	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall E	2026-06-22 22:04:54.649
21	70	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall F	2026-06-22 22:04:54.649
22	70	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall F	2026-06-22 22:04:54.65
23	76	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall G	2026-06-22 22:04:54.65
24	76	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall G	2026-06-22 22:04:54.651
25	30	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall H	2026-06-22 22:04:54.651
26	30	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall H	2026-06-22 22:04:54.652
27	88	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall I	2026-06-22 22:04:54.653
28	88	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall I	2026-06-22 22:04:54.654
29	94	MIDTERM	2026-07-15 00:00:00	09:00	11:00	Hall J	2026-06-22 22:04:54.654
30	94	FINAL	2026-08-20 00:00:00	09:00	12:00	Hall J	2026-06-22 22:04:54.655
\.


--
-- Data for Name: ExamAnswer; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExamAnswer" (id, "submissionId", "questionId", "selectedOption", "essayText", "fileUrl", "fileKey", score, feedback, "isCorrect", "gradedAt") FROM stdin;
\.


--
-- Data for Name: ExamQuestion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExamQuestion" (id, "examSessionId", type, text, "textAr", points, "orderIndex", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "maxWords", "allowedFileTypes") FROM stdin;
\.


--
-- Data for Name: ExamSession; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExamSession" (id, "examId", "courseId", "doctorId", title, instructions, "durationMinutes", "totalPoints", "passingScore", "shuffleQuestions", "showResultsAfter", "allowedAttempts", status, "opensAt", "closesAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ExamSubmission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExamSubmission" (id, "examSessionId", "studentId", status, "startedAt", "submittedAt", "totalScore", feedback, "violationCount") FROM stdin;
\.


--
-- Data for Name: ExamViolation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExamViolation" (id, "submissionId", type, "detectedAt", metadata) FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "userId", title, message, type, "isRead", "createdAt", link) FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Payment" (id, "studentId", amount, type, status, description, "dueDate", "paidAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Question; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Question" (id, "quizId", text, "optionA", "optionB", "optionC", "optionD", correct, points) FROM stdin;
1	1	What is the main topic of this course?	Option A	Option B	Option C	Option D	A	1
2	1	Which of the following is correct?	First	Second	Third	Fourth	B	1
3	1	Select the best answer:	Alpha	Beta	Gamma	Delta	C	2
4	1	Which option is most accurate?	One	Two	Three	Four	D	2
5	2	What is the main topic of this course?	Option A	Option B	Option C	Option D	A	1
6	2	Which of the following is correct?	First	Second	Third	Fourth	B	1
7	2	Select the best answer:	Alpha	Beta	Gamma	Delta	C	2
8	2	Which option is most accurate?	One	Two	Three	Four	D	2
9	3	What is the main topic of this course?	Option A	Option B	Option C	Option D	A	1
10	3	Which of the following is correct?	First	Second	Third	Fourth	B	1
11	3	Select the best answer:	Alpha	Beta	Gamma	Delta	C	2
12	3	Which option is most accurate?	One	Two	Three	Four	D	2
13	4	What is the main topic of this course?	Option A	Option B	Option C	Option D	A	1
14	4	Which of the following is correct?	First	Second	Third	Fourth	B	1
15	4	Select the best answer:	Alpha	Beta	Gamma	Delta	C	2
16	4	Which option is most accurate?	One	Two	Three	Four	D	2
17	5	What is the main topic of this course?	Option A	Option B	Option C	Option D	A	1
18	5	Which of the following is correct?	First	Second	Third	Fourth	B	1
19	5	Select the best answer:	Alpha	Beta	Gamma	Delta	C	2
20	5	Which option is most accurate?	One	Two	Three	Four	D	2
\.


--
-- Data for Name: Quiz; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Quiz" (id, title, description, "courseId", "doctorId", duration, "startTime", "endTime", "createdAt") FROM stdin;
1	Introduction to Programming - Quiz 1	Quiz for Introduction to Programming	26	1	30	2026-07-10 00:00:00	2026-07-10 00:30:00	2026-06-22 21:54:47.748
2	Data Structures - Quiz 2	Quiz for Data Structures	27	2	30	2026-07-11 00:00:00	2026-07-11 00:30:00	2026-06-22 21:54:47.754
3	Algorithms - Quiz 3	Quiz for Algorithms	28	3	30	2026-07-12 00:00:00	2026-07-12 00:30:00	2026-06-22 21:54:47.756
4	Calculus I - Quiz 4	Quiz for Calculus I	3	4	30	2026-07-13 00:00:00	2026-07-13 00:30:00	2026-06-22 21:54:47.757
5	Linear Algebra - Quiz 5	Quiz for Linear Algebra	29	5	30	2026-07-14 00:00:00	2026-07-14 00:30:00	2026-06-22 21:54:47.759
\.


--
-- Data for Name: QuizSubmission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."QuizSubmission" (id, "quizId", "studentId", answers, score, "submittedAt") FROM stdin;
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") FROM stdin;
1	ec6781b930d5f98a84bf3998c96790a9ac1ad9dcbb99597f84dcc7a459f9f7dbe518aeaa58eb928b	1	2026-07-22 17:49:28.945	2026-06-22 17:49:28.947
2	b8250f3548e491eb81f3c0854b4fe2e3a10b3e543db22a9c98b23d5c5f3614d779cb57a96c87ba70	1	2026-07-22 19:31:28.175	2026-06-22 19:31:28.178
3	59d4d5071d0f3ee09ac62d44effecb9cc1ada0296deec9c3d0bd4ac132eba4651adb10338d37576e	1	2026-07-22 21:55:56.525	2026-06-22 21:55:56.527
\.


--
-- Data for Name: RegistrationRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RegistrationRequest" (id, email, password, role, "firstName", "lastName", "departmentId", status, "createdAt", phone, "studentId", year, "rejectionReason") FROM stdin;
\.


--
-- Data for Name: Schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Schedule" (id, "courseId", "dayOfWeek", "startTime", "endTime", room, "createdAt", "assistantId") FROM stdin;
17	26	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.553	\N
18	26	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.554	\N
19	27	SUN	09:00	11:00	Hall B	2026-06-22 22:04:54.555	\N
20	27	WED	11:00	13:00	Mech Lab	2026-06-22 22:04:54.555	\N
21	28	MON	09:00	11:00	Hall C	2026-06-22 22:04:54.556	\N
22	28	THU	11:00	13:00	Energy Lab	2026-06-22 22:04:54.557	\N
23	29	SUN	09:00	11:00	Hall E	2026-06-22 22:04:54.557	\N
24	29	WED	11:00	13:00	Bio Lab	2026-06-22 22:04:54.558	\N
25	30	SUN	09:00	11:00	Hall H	2026-06-22 22:04:54.559	\N
26	30	WED	11:00	13:00	EMS Lab	2026-06-22 22:04:54.56	\N
27	33	SAT	09:00	11:00	Hall B	2026-06-22 22:04:54.56	\N
28	33	TUE	11:00	13:00	Mech Lab	2026-06-22 22:04:54.561	\N
29	34	SAT	09:00	11:00	Hall C	2026-06-22 22:04:54.561	\N
30	34	TUE	11:00	13:00	Energy Lab	2026-06-22 22:04:54.562	\N
31	35	SAT	09:00	11:00	Hall D	2026-06-22 22:04:54.563	\N
32	35	TUE	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.563	\N
33	36	SUN	09:00	11:00	Hall E	2026-06-22 22:04:54.564	\N
34	36	WED	11:00	13:00	Bio Lab	2026-06-22 22:04:54.564	\N
35	4	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.565	\N
36	4	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.565	\N
37	1	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.566	\N
38	1	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.566	\N
39	3	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.567	\N
40	3	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.567	\N
41	2	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.568	\N
42	2	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.569	\N
43	5	SAT	09:00	11:00	Hall A	2026-06-22 22:04:54.569	\N
44	5	TUE	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.57	\N
45	31	SUN	09:00	11:00	Hall A	2026-06-22 22:04:54.57	\N
46	31	WED	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.571	\N
47	43	SUN	09:00	11:00	Hall A	2026-06-22 22:04:54.571	\N
48	43	WED	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.572	\N
49	32	MON	09:00	11:00	Hall A	2026-06-22 22:04:54.572	\N
50	32	THU	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.573	\N
51	45	MON	09:00	11:00	Hall A	2026-06-22 22:04:54.574	\N
52	45	THU	11:00	13:00	ICT Lab 1	2026-06-22 22:04:54.574	\N
53	46	SAT	09:00	11:00	Hall B	2026-06-22 22:04:54.575	\N
54	46	TUE	11:00	13:00	Mech Lab	2026-06-22 22:04:54.576	\N
55	47	SAT	09:00	11:00	Hall B	2026-06-22 22:04:54.576	\N
56	47	TUE	11:00	13:00	Mech Lab	2026-06-22 22:04:54.577	\N
57	48	SUN	09:00	11:00	Hall B	2026-06-22 22:04:54.578	\N
58	48	WED	11:00	13:00	Mech Lab	2026-06-22 22:04:54.578	\N
59	49	SUN	09:00	11:00	Hall B	2026-06-22 22:04:54.579	\N
60	49	WED	11:00	13:00	Mech Lab	2026-06-22 22:04:54.579	\N
61	50	MON	09:00	11:00	Hall B	2026-06-22 22:04:54.58	\N
62	50	THU	11:00	13:00	Mech Lab	2026-06-22 22:04:54.581	\N
63	51	MON	09:00	11:00	Hall B	2026-06-22 22:04:54.581	\N
64	51	THU	11:00	13:00	Mech Lab	2026-06-22 22:04:54.582	\N
65	52	SAT	09:00	11:00	Hall C	2026-06-22 22:04:54.582	\N
66	52	TUE	11:00	13:00	Energy Lab	2026-06-22 22:04:54.583	\N
67	53	SAT	09:00	11:00	Hall C	2026-06-22 22:04:54.583	\N
68	53	TUE	11:00	13:00	Energy Lab	2026-06-22 22:04:54.584	\N
69	54	SUN	09:00	11:00	Hall C	2026-06-22 22:04:54.584	\N
70	54	WED	11:00	13:00	Energy Lab	2026-06-22 22:04:54.585	\N
71	55	SUN	09:00	11:00	Hall C	2026-06-22 22:04:54.585	\N
72	55	WED	11:00	13:00	Energy Lab	2026-06-22 22:04:54.586	\N
73	56	MON	09:00	11:00	Hall C	2026-06-22 22:04:54.586	\N
74	56	THU	11:00	13:00	Energy Lab	2026-06-22 22:04:54.587	\N
75	57	MON	09:00	11:00	Hall C	2026-06-22 22:04:54.587	\N
76	57	THU	11:00	13:00	Energy Lab	2026-06-22 22:04:54.588	\N
77	58	SAT	09:00	11:00	Hall D	2026-06-22 22:04:54.589	\N
78	58	TUE	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.589	\N
79	59	SAT	09:00	11:00	Hall D	2026-06-22 22:04:54.59	\N
80	59	TUE	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.59	\N
81	60	SUN	09:00	11:00	Hall D	2026-06-22 22:04:54.591	\N
82	60	WED	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.592	\N
83	61	SUN	09:00	11:00	Hall D	2026-06-22 22:04:54.592	\N
84	61	WED	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.594	\N
85	62	MON	09:00	11:00	Hall D	2026-06-22 22:04:54.594	\N
86	62	THU	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.596	\N
87	63	MON	09:00	11:00	Hall D	2026-06-22 22:04:54.597	\N
88	63	THU	11:00	13:00	Nursing Lab	2026-06-22 22:04:54.597	\N
89	64	SAT	09:00	11:00	Hall E	2026-06-22 22:04:54.598	\N
90	64	TUE	11:00	13:00	Bio Lab	2026-06-22 22:04:54.598	\N
91	65	SAT	09:00	11:00	Hall E	2026-06-22 22:04:54.599	\N
92	65	TUE	11:00	13:00	Bio Lab	2026-06-22 22:04:54.599	\N
93	66	SUN	09:00	11:00	Hall E	2026-06-22 22:04:54.6	\N
94	66	WED	11:00	13:00	Bio Lab	2026-06-22 22:04:54.601	\N
95	67	SUN	09:00	11:00	Hall E	2026-06-22 22:04:54.601	\N
96	67	WED	11:00	13:00	Bio Lab	2026-06-22 22:04:54.602	\N
97	68	MON	09:00	11:00	Hall E	2026-06-22 22:04:54.602	\N
98	68	THU	11:00	13:00	Bio Lab	2026-06-22 22:04:54.603	\N
99	69	MON	09:00	11:00	Hall E	2026-06-22 22:04:54.603	\N
100	69	THU	11:00	13:00	Bio Lab	2026-06-22 22:04:54.604	\N
101	70	SAT	09:00	11:00	Hall F	2026-06-22 22:04:54.604	\N
102	70	TUE	11:00	13:00	Railway Lab	2026-06-22 22:04:54.605	\N
103	71	SAT	09:00	11:00	Hall F	2026-06-22 22:04:54.605	\N
104	71	TUE	11:00	13:00	Railway Lab	2026-06-22 22:04:54.606	\N
105	72	SUN	09:00	11:00	Hall F	2026-06-22 22:04:54.607	\N
106	72	WED	11:00	13:00	Railway Lab	2026-06-22 22:04:54.607	\N
107	73	SUN	09:00	11:00	Hall F	2026-06-22 22:04:54.608	\N
108	73	WED	11:00	13:00	Railway Lab	2026-06-22 22:04:54.608	\N
109	74	MON	09:00	11:00	Hall F	2026-06-22 22:04:54.609	\N
110	74	THU	11:00	13:00	Railway Lab	2026-06-22 22:04:54.61	\N
111	75	MON	09:00	11:00	Hall F	2026-06-22 22:04:54.611	\N
112	75	THU	11:00	13:00	Railway Lab	2026-06-22 22:04:54.611	\N
113	76	SAT	09:00	11:00	Hall G	2026-06-22 22:04:54.612	\N
114	76	TUE	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.612	\N
115	77	SAT	09:00	11:00	Hall G	2026-06-22 22:04:54.614	\N
116	77	TUE	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.614	\N
117	78	SUN	09:00	11:00	Hall G	2026-06-22 22:04:54.615	\N
118	78	WED	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.615	\N
119	79	SUN	09:00	11:00	Hall G	2026-06-22 22:04:54.616	\N
120	79	WED	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.616	\N
121	80	MON	09:00	11:00	Hall G	2026-06-22 22:04:54.617	\N
122	80	THU	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.617	\N
123	81	MON	09:00	11:00	Hall G	2026-06-22 22:04:54.618	\N
124	81	THU	11:00	13:00	Auto Workshop	2026-06-22 22:04:54.618	\N
125	82	SAT	09:00	11:00	Hall H	2026-06-22 22:04:54.619	\N
126	82	TUE	11:00	13:00	EMS Lab	2026-06-22 22:04:54.619	\N
127	83	SAT	09:00	11:00	Hall H	2026-06-22 22:04:54.62	\N
128	83	TUE	11:00	13:00	EMS Lab	2026-06-22 22:04:54.621	\N
129	84	SUN	09:00	11:00	Hall H	2026-06-22 22:04:54.621	\N
130	84	WED	11:00	13:00	EMS Lab	2026-06-22 22:04:54.622	\N
131	85	SUN	09:00	11:00	Hall H	2026-06-22 22:04:54.622	\N
132	85	WED	11:00	13:00	EMS Lab	2026-06-22 22:04:54.623	\N
133	86	MON	09:00	11:00	Hall H	2026-06-22 22:04:54.623	\N
134	86	THU	11:00	13:00	EMS Lab	2026-06-22 22:04:54.624	\N
135	87	MON	09:00	11:00	Hall H	2026-06-22 22:04:54.624	\N
136	87	THU	11:00	13:00	EMS Lab	2026-06-22 22:04:54.625	\N
137	88	SAT	09:00	11:00	Hall I	2026-06-22 22:04:54.626	\N
138	88	TUE	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.627	\N
139	89	SAT	09:00	11:00	Hall I	2026-06-22 22:04:54.627	\N
140	89	TUE	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.628	\N
141	90	SUN	09:00	11:00	Hall I	2026-06-22 22:04:54.628	\N
142	90	WED	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.629	\N
143	91	SUN	09:00	11:00	Hall I	2026-06-22 22:04:54.629	\N
144	91	WED	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.63	\N
145	92	MON	09:00	11:00	Hall I	2026-06-22 22:04:54.63	\N
146	92	THU	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.631	\N
147	93	MON	09:00	11:00	Hall I	2026-06-22 22:04:54.632	\N
148	93	THU	11:00	13:00	P&O Workshop	2026-06-22 22:04:54.632	\N
149	94	SAT	09:00	11:00	Hall J	2026-06-22 22:04:54.633	\N
150	94	TUE	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.633	\N
151	95	SAT	09:00	11:00	Hall J	2026-06-22 22:04:54.634	\N
152	95	TUE	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.634	\N
153	96	SUN	09:00	11:00	Hall J	2026-06-22 22:04:54.635	\N
154	96	WED	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.635	\N
155	97	SUN	09:00	11:00	Hall J	2026-06-22 22:04:54.636	\N
156	97	WED	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.636	\N
157	98	MON	09:00	11:00	Hall J	2026-06-22 22:04:54.637	\N
158	98	THU	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.637	\N
159	99	MON	09:00	11:00	Hall J	2026-06-22 22:04:54.638	\N
160	99	THU	11:00	13:00	X-Ray Lab	2026-06-22 22:04:54.639	\N
\.


--
-- Data for Name: Student; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Student" (id, "userId", "firstName", "lastName", "studentId", phone, address, "enrolledAt", "departmentId", bio, "birthDate", gender, "isActive", year) FROM stdin;
80	566	Mona	Saeed	RLW-2024-004	\N	\N	2026-06-22 22:04:54.09	6	\N	\N	\N	t	1
81	567	Youssef	Mahmoud	RLW-2024-005	\N	\N	2026-06-22 22:04:54.1	6	\N	\N	\N	t	2
82	568	Heba	Fathy	RLW-2024-006	\N	\N	2026-06-22 22:04:54.11	6	\N	\N	\N	t	2
83	569	Amr	Nasser	RLW-2024-007	\N	\N	2026-06-22 22:04:54.119	6	\N	\N	\N	t	2
6	370	Ahmed	Ali	S2024001	\N	\N	2026-06-22 21:54:47.57	1	\N	\N	\N	t	1
7	371	Mohamed	Hassan	S2024002	\N	\N	2026-06-22 21:54:47.574	2	\N	\N	\N	t	2
8	372	Sara	Ahmed	S2024003	\N	\N	2026-06-22 21:54:47.576	3	\N	\N	\N	t	3
9	373	Nour	Mohamed	S2024004	\N	\N	2026-06-22 21:54:47.579	4	\N	\N	\N	t	4
10	374	Omar	Ibrahim	S2024005	\N	\N	2026-06-22 21:54:47.581	5	\N	\N	\N	t	1
11	375	Layla	Mahmoud	S2024006	\N	\N	2026-06-22 21:54:47.584	6	\N	\N	\N	t	2
12	376	Khaled	Sayed	S2024007	\N	\N	2026-06-22 21:54:47.587	7	\N	\N	\N	t	3
13	377	Mona	Omar	S2024008	\N	\N	2026-06-22 21:54:47.59	8	\N	\N	\N	t	4
14	378	Hassan	Kamal	S2024009	\N	\N	2026-06-22 21:54:47.593	9	\N	\N	\N	t	1
15	379	Dina	Nasser	S2024010	\N	\N	2026-06-22 21:54:47.596	10	\N	\N	\N	t	2
16	380	Youssef	Fathi	S2024011	\N	\N	2026-06-22 21:54:47.598	1	\N	\N	\N	t	3
17	381	Rania	Samir	S2024012	\N	\N	2026-06-22 21:54:47.6	2	\N	\N	\N	t	4
18	382	Tarek	Adel	S2024013	\N	\N	2026-06-22 21:54:47.602	3	\N	\N	\N	t	1
19	383	Heba	Lotfy	S2024014	\N	\N	2026-06-22 21:54:47.605	4	\N	\N	\N	t	2
20	384	Amr	Ramadan	S2024015	\N	\N	2026-06-22 21:54:47.608	5	\N	\N	\N	t	3
21	385	Nadia	Gaber	S2024016	\N	\N	2026-06-22 21:54:47.61	6	\N	\N	\N	t	4
22	386	Sherif	Hamdy	S2024017	\N	\N	2026-06-22 21:54:47.613	7	\N	\N	\N	t	1
23	387	Eman	Shafik	S2024018	\N	\N	2026-06-22 21:54:47.615	8	\N	\N	\N	t	2
24	388	Wael	Zaki	S2024019	\N	\N	2026-06-22 21:54:47.617	9	\N	\N	\N	t	3
25	389	Salma	Fouad	S2024020	\N	\N	2026-06-22 21:54:47.619	10	\N	\N	\N	t	4
1	13	Omar	Hassan	STU20260001	\N	\N	2026-06-22 17:47:04.104	1	\N	\N	\N	t	1
27	513	Omar	Ali	ICT-2024-001	\N	\N	2026-06-22 22:04:53.444	1	\N	\N	\N	t	1
28	514	Sara	Hassan	ICT-2024-002	\N	\N	2026-06-22 22:04:53.458	1	\N	\N	\N	t	1
29	515	Mohamed	Ibrahim	ICT-2024-003	\N	\N	2026-06-22 22:04:53.472	1	\N	\N	\N	t	1
30	516	Mona	Saeed	ICT-2024-004	\N	\N	2026-06-22 22:04:53.485	1	\N	\N	\N	t	1
31	517	Youssef	Mahmoud	ICT-2024-005	\N	\N	2026-06-22 22:04:53.499	1	\N	\N	\N	t	2
32	518	Heba	Fathy	ICT-2024-006	\N	\N	2026-06-22 22:04:53.516	1	\N	\N	\N	t	2
33	519	Amr	Nasser	ICT-2024-007	\N	\N	2026-06-22 22:04:53.53	1	\N	\N	\N	t	2
34	520	Eman	Kamal	ICT-2024-008	\N	\N	2026-06-22 22:04:53.544	1	\N	\N	\N	t	3
35	521	Mahmoud	Salem	ICT-2024-009	\N	\N	2026-06-22 22:04:53.557	1	\N	\N	\N	t	3
36	522	Aya	Rashad	ICT-2024-010	\N	\N	2026-06-22 22:04:53.571	1	\N	\N	\N	t	3
37	523	Omar	Ali	MEC-2024-001	\N	\N	2026-06-22 22:04:53.585	2	\N	\N	\N	t	1
38	524	Sara	Hassan	MEC-2024-002	\N	\N	2026-06-22 22:04:53.597	2	\N	\N	\N	t	1
39	525	Mohamed	Ibrahim	MEC-2024-003	\N	\N	2026-06-22 22:04:53.607	2	\N	\N	\N	t	1
40	526	Mona	Saeed	MEC-2024-004	\N	\N	2026-06-22 22:04:53.619	2	\N	\N	\N	t	1
41	527	Youssef	Mahmoud	MEC-2024-005	\N	\N	2026-06-22 22:04:53.631	2	\N	\N	\N	t	2
42	528	Heba	Fathy	MEC-2024-006	\N	\N	2026-06-22 22:04:53.642	2	\N	\N	\N	t	2
43	529	Amr	Nasser	MEC-2024-007	\N	\N	2026-06-22 22:04:53.653	2	\N	\N	\N	t	2
44	530	Eman	Kamal	MEC-2024-008	\N	\N	2026-06-22 22:04:53.665	2	\N	\N	\N	t	3
45	531	Mahmoud	Salem	MEC-2024-009	\N	\N	2026-06-22 22:04:53.677	2	\N	\N	\N	t	3
46	532	Aya	Rashad	MEC-2024-010	\N	\N	2026-06-22 22:04:53.688	2	\N	\N	\N	t	3
47	533	Omar	Ali	REN-2024-001	\N	\N	2026-06-22 22:04:53.702	3	\N	\N	\N	t	1
48	534	Sara	Hassan	REN-2024-002	\N	\N	2026-06-22 22:04:53.714	3	\N	\N	\N	t	1
49	535	Mohamed	Ibrahim	REN-2024-003	\N	\N	2026-06-22 22:04:53.727	3	\N	\N	\N	t	1
50	536	Mona	Saeed	REN-2024-004	\N	\N	2026-06-22 22:04:53.738	3	\N	\N	\N	t	1
51	537	Youssef	Mahmoud	REN-2024-005	\N	\N	2026-06-22 22:04:53.75	3	\N	\N	\N	t	2
52	538	Heba	Fathy	REN-2024-006	\N	\N	2026-06-22 22:04:53.763	3	\N	\N	\N	t	2
53	539	Amr	Nasser	REN-2024-007	\N	\N	2026-06-22 22:04:53.776	3	\N	\N	\N	t	2
54	540	Eman	Kamal	REN-2024-008	\N	\N	2026-06-22 22:04:53.789	3	\N	\N	\N	t	3
55	541	Mahmoud	Salem	REN-2024-009	\N	\N	2026-06-22 22:04:53.801	3	\N	\N	\N	t	3
56	542	Aya	Rashad	REN-2024-010	\N	\N	2026-06-22 22:04:53.814	3	\N	\N	\N	t	3
57	543	Omar	Ali	NUR-2024-001	\N	\N	2026-06-22 22:04:53.827	4	\N	\N	\N	t	1
58	544	Sara	Hassan	NUR-2024-002	\N	\N	2026-06-22 22:04:53.838	4	\N	\N	\N	t	1
59	545	Mohamed	Ibrahim	NUR-2024-003	\N	\N	2026-06-22 22:04:53.85	4	\N	\N	\N	t	1
60	546	Mona	Saeed	NUR-2024-004	\N	\N	2026-06-22 22:04:53.863	4	\N	\N	\N	t	1
61	547	Youssef	Mahmoud	NUR-2024-005	\N	\N	2026-06-22 22:04:53.874	4	\N	\N	\N	t	2
62	548	Heba	Fathy	NUR-2024-006	\N	\N	2026-06-22 22:04:53.884	4	\N	\N	\N	t	2
63	549	Amr	Nasser	NUR-2024-007	\N	\N	2026-06-22 22:04:53.895	4	\N	\N	\N	t	2
64	550	Eman	Kamal	NUR-2024-008	\N	\N	2026-06-22 22:04:53.906	4	\N	\N	\N	t	3
65	551	Mahmoud	Salem	NUR-2024-009	\N	\N	2026-06-22 22:04:53.916	4	\N	\N	\N	t	3
66	552	Aya	Rashad	NUR-2024-010	\N	\N	2026-06-22 22:04:53.928	4	\N	\N	\N	t	3
67	553	Omar	Ali	MED-2024-001	\N	\N	2026-06-22 22:04:53.94	5	\N	\N	\N	t	1
68	554	Sara	Hassan	MED-2024-002	\N	\N	2026-06-22 22:04:53.952	5	\N	\N	\N	t	1
69	555	Mohamed	Ibrahim	MED-2024-003	\N	\N	2026-06-22 22:04:53.965	5	\N	\N	\N	t	1
70	556	Mona	Saeed	MED-2024-004	\N	\N	2026-06-22 22:04:53.979	5	\N	\N	\N	t	1
71	557	Youssef	Mahmoud	MED-2024-005	\N	\N	2026-06-22 22:04:53.991	5	\N	\N	\N	t	2
72	558	Heba	Fathy	MED-2024-006	\N	\N	2026-06-22 22:04:54.004	5	\N	\N	\N	t	2
73	559	Amr	Nasser	MED-2024-007	\N	\N	2026-06-22 22:04:54.016	5	\N	\N	\N	t	2
74	560	Eman	Kamal	MED-2024-008	\N	\N	2026-06-22 22:04:54.027	5	\N	\N	\N	t	3
75	561	Mahmoud	Salem	MED-2024-009	\N	\N	2026-06-22 22:04:54.039	5	\N	\N	\N	t	3
76	562	Aya	Rashad	MED-2024-010	\N	\N	2026-06-22 22:04:54.051	5	\N	\N	\N	t	3
77	563	Omar	Ali	RLW-2024-001	\N	\N	2026-06-22 22:04:54.063	6	\N	\N	\N	t	1
78	564	Sara	Hassan	RLW-2024-002	\N	\N	2026-06-22 22:04:54.072	6	\N	\N	\N	t	1
79	565	Mohamed	Ibrahim	RLW-2024-003	\N	\N	2026-06-22 22:04:54.081	6	\N	\N	\N	t	1
84	570	Eman	Kamal	RLW-2024-008	\N	\N	2026-06-22 22:04:54.129	6	\N	\N	\N	t	3
85	571	Mahmoud	Salem	RLW-2024-009	\N	\N	2026-06-22 22:04:54.138	6	\N	\N	\N	t	3
86	572	Aya	Rashad	RLW-2024-010	\N	\N	2026-06-22 22:04:54.147	6	\N	\N	\N	t	3
87	573	Omar	Ali	AUT-2024-001	\N	\N	2026-06-22 22:04:54.157	7	\N	\N	\N	t	1
88	574	Sara	Hassan	AUT-2024-002	\N	\N	2026-06-22 22:04:54.166	7	\N	\N	\N	t	1
89	575	Mohamed	Ibrahim	AUT-2024-003	\N	\N	2026-06-22 22:04:54.176	7	\N	\N	\N	t	1
90	576	Mona	Saeed	AUT-2024-004	\N	\N	2026-06-22 22:04:54.186	7	\N	\N	\N	t	1
91	577	Youssef	Mahmoud	AUT-2024-005	\N	\N	2026-06-22 22:04:54.196	7	\N	\N	\N	t	2
92	578	Heba	Fathy	AUT-2024-006	\N	\N	2026-06-22 22:04:54.204	7	\N	\N	\N	t	2
93	579	Amr	Nasser	AUT-2024-007	\N	\N	2026-06-22 22:04:54.215	7	\N	\N	\N	t	2
94	580	Eman	Kamal	AUT-2024-008	\N	\N	2026-06-22 22:04:54.224	7	\N	\N	\N	t	3
95	581	Mahmoud	Salem	AUT-2024-009	\N	\N	2026-06-22 22:04:54.234	7	\N	\N	\N	t	3
96	582	Aya	Rashad	AUT-2024-010	\N	\N	2026-06-22 22:04:54.244	7	\N	\N	\N	t	3
97	583	Omar	Ali	EMS-2024-001	\N	\N	2026-06-22 22:04:54.254	8	\N	\N	\N	t	1
98	584	Sara	Hassan	EMS-2024-002	\N	\N	2026-06-22 22:04:54.264	8	\N	\N	\N	t	1
99	585	Mohamed	Ibrahim	EMS-2024-003	\N	\N	2026-06-22 22:04:54.274	8	\N	\N	\N	t	1
100	586	Mona	Saeed	EMS-2024-004	\N	\N	2026-06-22 22:04:54.286	8	\N	\N	\N	t	1
101	587	Youssef	Mahmoud	EMS-2024-005	\N	\N	2026-06-22 22:04:54.297	8	\N	\N	\N	t	2
102	588	Heba	Fathy	EMS-2024-006	\N	\N	2026-06-22 22:04:54.306	8	\N	\N	\N	t	2
103	589	Amr	Nasser	EMS-2024-007	\N	\N	2026-06-22 22:04:54.317	8	\N	\N	\N	t	2
104	590	Eman	Kamal	EMS-2024-008	\N	\N	2026-06-22 22:04:54.328	8	\N	\N	\N	t	3
105	591	Mahmoud	Salem	EMS-2024-009	\N	\N	2026-06-22 22:04:54.338	8	\N	\N	\N	t	3
106	592	Aya	Rashad	EMS-2024-010	\N	\N	2026-06-22 22:04:54.349	8	\N	\N	\N	t	3
107	593	Omar	Ali	PRO-2024-001	\N	\N	2026-06-22 22:04:54.36	9	\N	\N	\N	t	1
108	594	Sara	Hassan	PRO-2024-002	\N	\N	2026-06-22 22:04:54.368	9	\N	\N	\N	t	1
109	595	Mohamed	Ibrahim	PRO-2024-003	\N	\N	2026-06-22 22:04:54.378	9	\N	\N	\N	t	1
110	596	Mona	Saeed	PRO-2024-004	\N	\N	2026-06-22 22:04:54.387	9	\N	\N	\N	t	1
111	597	Youssef	Mahmoud	PRO-2024-005	\N	\N	2026-06-22 22:04:54.397	9	\N	\N	\N	t	2
112	598	Heba	Fathy	PRO-2024-006	\N	\N	2026-06-22 22:04:54.405	9	\N	\N	\N	t	2
113	599	Amr	Nasser	PRO-2024-007	\N	\N	2026-06-22 22:04:54.415	9	\N	\N	\N	t	2
114	600	Eman	Kamal	PRO-2024-008	\N	\N	2026-06-22 22:04:54.424	9	\N	\N	\N	t	3
115	601	Mahmoud	Salem	PRO-2024-009	\N	\N	2026-06-22 22:04:54.434	9	\N	\N	\N	t	3
116	602	Aya	Rashad	PRO-2024-010	\N	\N	2026-06-22 22:04:54.444	9	\N	\N	\N	t	3
117	603	Omar	Ali	RAD-2024-001	\N	\N	2026-06-22 22:04:54.454	10	\N	\N	\N	t	1
118	604	Sara	Hassan	RAD-2024-002	\N	\N	2026-06-22 22:04:54.464	10	\N	\N	\N	t	1
119	605	Mohamed	Ibrahim	RAD-2024-003	\N	\N	2026-06-22 22:04:54.472	10	\N	\N	\N	t	1
120	606	Mona	Saeed	RAD-2024-004	\N	\N	2026-06-22 22:04:54.483	10	\N	\N	\N	t	1
121	607	Youssef	Mahmoud	RAD-2024-005	\N	\N	2026-06-22 22:04:54.493	10	\N	\N	\N	t	2
122	608	Heba	Fathy	RAD-2024-006	\N	\N	2026-06-22 22:04:54.503	10	\N	\N	\N	t	2
123	609	Amr	Nasser	RAD-2024-007	\N	\N	2026-06-22 22:04:54.514	10	\N	\N	\N	t	2
124	610	Eman	Kamal	RAD-2024-008	\N	\N	2026-06-22 22:04:54.523	10	\N	\N	\N	t	3
125	611	Mahmoud	Salem	RAD-2024-009	\N	\N	2026-06-22 22:04:54.534	10	\N	\N	\N	t	3
126	612	Aya	Rashad	RAD-2024-010	\N	\N	2026-06-22 22:04:54.544	10	\N	\N	\N	t	3
\.


--
-- Data for Name: StudentSuccessMetric; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."StudentSuccessMetric" (id, "studentId", "attendanceRate", "averageQuizScore", "assignmentCompletionRate", "predictedRisk", "lastCalculated") FROM stdin;
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Task" (id, title, description, "courseId", "doctorId", "dueDate", "maxScore", "createdAt") FROM stdin;
\.


--
-- Data for Name: TaskSubmission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TaskSubmission" (id, "taskId", "studentId", "fileUrl", notes, score, "submittedAt") FROM stdin;
\.


--
-- Data for Name: TeachingAssistant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TeachingAssistant" (id, "userId", "departmentId", specialization, "createdAt", "updatedAt") FROM stdin;
1	14	1	Programming	2026-06-22 17:47:04.172	2026-06-22 22:04:52.961
2	15	1	Information Technology	2026-06-22 17:47:04.175	2026-06-22 22:04:52.964
3	16	2	Mechatronics	2026-06-22 17:47:04.177	2026-06-22 22:04:52.966
4	17	4	Nursing	2026-06-22 17:47:04.179	2026-06-22 22:04:52.967
5	22	1	ICT	2026-06-22 17:47:04.324	2026-06-22 22:04:53.111
6	23	1	ICT	2026-06-22 17:47:04.326	2026-06-22 22:04:53.113
7	28	2	Mechatronics	2026-06-22 17:47:04.335	2026-06-22 22:04:53.12
8	29	2	Mechatronics	2026-06-22 17:47:04.336	2026-06-22 22:04:53.122
9	34	3	Renewable Energy	2026-06-22 17:47:04.343	2026-06-22 22:04:53.129
10	35	3	Renewable Energy	2026-06-22 17:47:04.345	2026-06-22 22:04:53.131
11	40	6	Railway Technology	2026-06-22 17:47:04.353	2026-06-22 22:04:53.138
12	41	6	Railway Technology	2026-06-22 17:47:04.354	2026-06-22 22:04:53.139
13	46	7	Automotive Technology	2026-06-22 17:47:04.361	2026-06-22 22:04:53.147
14	47	7	Automotive Technology	2026-06-22 17:47:04.363	2026-06-22 22:04:53.148
15	52	4	Nursing Department	2026-06-22 17:47:04.371	2026-06-22 22:04:53.156
16	53	4	Nursing Department	2026-06-22 17:47:04.375	2026-06-22 22:04:53.157
17	58	5	Medical Labs Department	2026-06-22 17:47:04.383	2026-06-22 22:04:53.165
18	59	5	Medical Labs Department	2026-06-22 17:47:04.385	2026-06-22 22:04:53.166
19	64	10	Radiology	2026-06-22 17:47:04.392	2026-06-22 22:04:53.173
20	65	10	Radiology	2026-06-22 17:47:04.393	2026-06-22 22:04:53.174
21	70	8	Emergency Medical Services	2026-06-22 17:47:04.401	2026-06-22 22:04:53.182
22	71	8	Emergency Medical Services	2026-06-22 17:47:04.402	2026-06-22 22:04:53.183
23	76	9	Prosthetics and Orthotics	2026-06-22 17:47:04.409	2026-06-22 22:04:53.19
24	77	9	Prosthetics and Orthotics	2026-06-22 17:47:04.41	2026-06-22 22:04:53.191
145	483	1	Mahmoud Fathi	2026-06-22 22:04:53.386	2026-06-22 22:04:53.386
146	484	1	Yasmine Helmy	2026-06-22 22:04:53.389	2026-06-22 22:04:53.389
147	485	1	Bassem Nour	2026-06-22 22:04:53.39	2026-06-22 22:04:53.39
148	486	2	Kareem Zaki	2026-06-22 22:04:53.393	2026-06-22 22:04:53.393
149	487	2	Nermeen Hani	2026-06-22 22:04:53.395	2026-06-22 22:04:53.395
150	488	2	Taha Saeed	2026-06-22 22:04:53.397	2026-06-22 22:04:53.397
151	489	3	Lina Mostafa	2026-06-22 22:04:53.399	2026-06-22 22:04:53.399
152	490	3	Ahmed Sobhi	2026-06-22 22:04:53.401	2026-06-22 22:04:53.401
153	491	3	Rasha Fikry	2026-06-22 22:04:53.403	2026-06-22 22:04:53.403
154	492	4	Abeer Salem	2026-06-22 22:04:53.404	2026-06-22 22:04:53.404
155	493	4	Walaa Morsy	2026-06-22 22:04:53.406	2026-06-22 22:04:53.406
156	494	4	Osama Nabil	2026-06-22 22:04:53.408	2026-06-22 22:04:53.408
157	495	5	Enas Wahid	2026-06-22 22:04:53.41	2026-06-22 22:04:53.41
158	496	5	Moustafa Galal	2026-06-22 22:04:53.412	2026-06-22 22:04:53.412
159	497	5	Shady Amin	2026-06-22 22:04:53.414	2026-06-22 22:04:53.414
160	498	6	Younis Hamed	2026-06-22 22:04:53.415	2026-06-22 22:04:53.415
161	499	6	Nihal Fouad	2026-06-22 22:04:53.417	2026-06-22 22:04:53.417
162	500	6	Sameh Rizk	2026-06-22 22:04:53.419	2026-06-22 22:04:53.419
163	501	7	Alaa Badawi	2026-06-22 22:04:53.42	2026-06-22 22:04:53.42
164	502	7	Dena Refaat	2026-06-22 22:04:53.422	2026-06-22 22:04:53.422
165	503	7	Khaled Saber	2026-06-22 22:04:53.424	2026-06-22 22:04:53.424
166	504	8	Mervat Gouda	2026-06-22 22:04:53.426	2026-06-22 22:04:53.426
167	505	8	Tarek Ashraf	2026-06-22 22:04:53.428	2026-06-22 22:04:53.428
168	506	8	Hana Magdy	2026-06-22 22:04:53.43	2026-06-22 22:04:53.43
169	507	9	Ramy Hossam	2026-06-22 22:04:53.432	2026-06-22 22:04:53.432
170	508	9	Soha Lotfy	2026-06-22 22:04:53.434	2026-06-22 22:04:53.434
171	509	9	Amir Fahmy	2026-06-22 22:04:53.436	2026-06-22 22:04:53.436
172	510	10	Ghalia Zein	2026-06-22 22:04:53.437	2026-06-22 22:04:53.437
173	511	10	Manar Atef	2026-06-22 22:04:53.439	2026-06-22 22:04:53.439
174	512	10	Sherihan Wafi	2026-06-22 22:04:53.441	2026-06-22 22:04:53.441
\.


--
-- Data for Name: Timetable; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Timetable" (id, "collegeId", "departmentId", "academicYear", semester, title, description, "scheduleData", "fileUrl", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, password, role, "createdAt", "adminRole", "profilePicture", "collegeId", "departmentId", "tokenVersion", "twoFactorEnabled", "twoFactorSecret", "managedCollegeId", "managedDepartmentId") FROM stdin;
12	doctor@university.com	$2b$10$vPET2GGw3wCbtUZX5vcIXe6KvLFnlbyBFG9TVfKehfddkBTF46MQK	DOCTOR	2026-06-22 17:47:04.099	\N	\N	\N	\N	0	f	\N	\N	\N
13	student@university.com	$2b$10$vPET2GGw3wCbtUZX5vcIXe6KvLFnlbyBFG9TVfKehfddkBTF46MQK	STUDENT	2026-06-22 17:47:04.103	\N	\N	\N	\N	0	f	\N	\N	\N
14	ta@university.com	$2b$10$hcoxui2ATzAv6dyhsfjL5Olc/DoRUACGbY6EijRTOsV1AaP66Sj7W	TEACHING_ASSISTANT	2026-06-22 17:47:04.169	\N	\N	\N	\N	0	f	\N	\N	\N
15	ta1@university.com	$2b$10$hcoxui2ATzAv6dyhsfjL5Olc/DoRUACGbY6EijRTOsV1AaP66Sj7W	TEACHING_ASSISTANT	2026-06-22 17:47:04.174	\N	\N	\N	\N	0	f	\N	\N	\N
16	ta2@university.com	$2b$10$hcoxui2ATzAv6dyhsfjL5Olc/DoRUACGbY6EijRTOsV1AaP66Sj7W	TEACHING_ASSISTANT	2026-06-22 17:47:04.176	\N	\N	\N	\N	0	f	\N	\N	\N
17	ta3@university.com	$2b$10$hcoxui2ATzAv6dyhsfjL5Olc/DoRUACGbY6EijRTOsV1AaP66Sj7W	TEACHING_ASSISTANT	2026-06-22 17:47:04.178	\N	\N	\N	\N	0	f	\N	\N	\N
6	mechatronicsdepartment.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.085	\N	\N	\N	\N	0	f	\N	\N	2
7	mechatronics.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.086	\N	\N	\N	\N	0	f	\N	\N	2
8	renewableenergydepartment.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.087	\N	\N	\N	\N	0	f	\N	\N	3
9	renewableenergy.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.088	\N	\N	\N	\N	0	f	\N	\N	3
10	railwaytechnology.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.089	\N	\N	\N	\N	0	f	\N	\N	6
11	automotivetechnology.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.09	\N	\N	\N	\N	0	f	\N	\N	7
18	khaled.mansour@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.313	\N	\N	\N	\N	0	f	\N	\N	\N
19	nadia.samir@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.317	\N	\N	\N	\N	0	f	\N	\N	\N
20	tarek.fouad@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.318	\N	\N	\N	\N	0	f	\N	\N	\N
21	heba.nasser@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.32	\N	\N	\N	\N	0	f	\N	\N	\N
22	kareem.nabil.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.322	\N	\N	\N	\N	0	f	\N	\N	\N
23	nour.youssef.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.326	\N	\N	\N	\N	0	f	\N	\N	\N
24	youssef.ibrahim@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.327	\N	\N	\N	\N	0	f	\N	\N	\N
25	rania.khalil@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.329	\N	\N	\N	\N	0	f	\N	\N	\N
26	mostafa.sayed@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.331	\N	\N	\N	\N	0	f	\N	\N	\N
27	dina.wahba@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.333	\N	\N	\N	\N	0	f	\N	\N	\N
28	omar.tarek.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.334	\N	\N	\N	\N	0	f	\N	\N	\N
29	laila.mahmoud.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.336	\N	\N	\N	\N	0	f	\N	\N	\N
30	hassan.ali@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.337	\N	\N	\N	\N	0	f	\N	\N	\N
31	mona.salem@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.338	\N	\N	\N	\N	0	f	\N	\N	\N
32	omar.farouk@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.34	\N	\N	\N	\N	0	f	\N	\N	\N
33	salma.yasser@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.341	\N	\N	\N	\N	0	f	\N	\N	\N
34	hisham.ali.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.343	\N	\N	\N	\N	0	f	\N	\N	\N
35	mervat.sayed.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.344	\N	\N	\N	\N	0	f	\N	\N	\N
36	ahmed.kamal@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.346	\N	\N	\N	\N	0	f	\N	\N	\N
37	tarek.amin@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.347	\N	\N	\N	\N	0	f	\N	\N	\N
38	hoda.samir@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.349	\N	\N	\N	\N	0	f	\N	\N	\N
39	nabil.fathy@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.35	\N	\N	\N	\N	0	f	\N	\N	\N
40	sameh.hassan.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.352	\N	\N	\N	\N	0	f	\N	\N	\N
41	shady.amin.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.353	\N	\N	\N	\N	0	f	\N	\N	\N
42	mahmoud.ezzat@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.354	\N	\N	\N	\N	0	f	\N	\N	\N
43	yasser.sami@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.356	\N	\N	\N	\N	0	f	\N	\N	\N
44	fatma.zahran@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.357	\N	\N	\N	\N	0	f	\N	\N	\N
45	karim.nabil@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.359	\N	\N	\N	\N	0	f	\N	\N	\N
46	wael.mostafa.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.36	\N	\N	\N	\N	0	f	\N	\N	\N
47	ramy.ezzat.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.362	\N	\N	\N	\N	0	f	\N	\N	\N
48	amal.karim@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.364	\N	\N	\N	\N	0	f	\N	\N	\N
49	hoda.selim@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.366	\N	\N	\N	\N	0	f	\N	\N	\N
51	samia.fathy@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.369	\N	\N	\N	\N	0	f	\N	\N	\N
52	nour.ali.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.371	\N	\N	\N	\N	0	f	\N	\N	\N
1	superadmin@university.com	$2b$10$MV9CoXHW55KvVgg/O5ImE.TIWxuoT/DmBI5zYD67P.4GuXnA9JnoG	SUPER_ADMIN	2026-06-22 17:47:03.954	\N	\N	\N	\N	0	f	\N	\N	\N
2	admin@university.com	$2b$10$saw9j1dzom6iHAbthtDV1.vy6A7yo/AmHvsnUTID/zrMLgYSSXnle	ADMIN	2026-06-22 17:47:03.957	\N	\N	\N	\N	0	f	\N	\N	\N
4	dept.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.082	\N	\N	\N	\N	0	f	\N	\N	1
5	informationcommunicationtechnology.admin@university.com	$2b$10$lm8jrNNUfvv4.H1zyE4/a.Uz9NyNhOCOpOOW.Us2lPHVsWKzEfuIW	DEPARTMENT_ADMIN	2026-06-22 17:47:04.084	\N	\N	\N	\N	0	f	\N	\N	1
374	student5@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.58	\N	\N	\N	\N	0	f	\N	\N	\N
375	student6@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.583	\N	\N	\N	\N	0	f	\N	\N	\N
376	student7@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.586	\N	\N	\N	\N	0	f	\N	\N	\N
377	student8@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.589	\N	\N	\N	\N	0	f	\N	\N	\N
149	health.admin@university.com	$2b$10$ANcMr2ctAF6HxylFQZfqee02ByCNF.uJr3/7IlpS67NpWTqboamN6	COLLEGE_ADMIN	2026-06-22 18:00:59.154	\N	\N	\N	\N	0	f	\N	2	\N
150	industry.admin@university.com	$2b$10$wtlHbCGZ989YOO6P2.l0seIeDSyfw4JOsyw9ZjN3zRk1Vn1pd/qQG	COLLEGE_ADMIN	2026-06-22 18:00:59.16	\N	\N	\N	\N	0	f	\N	1	\N
50	marwa.nabil@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.368	\N	\N	\N	\N	0	f	\N	\N	\N
53	yasmine.tarek.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.372	\N	\N	\N	\N	0	f	\N	\N	\N
54	ehab.morsi@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.376	\N	\N	\N	\N	0	f	\N	\N	\N
64	kareem.hassan.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.391	\N	\N	\N	\N	0	f	\N	\N	\N
65	mona.adel.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.392	\N	\N	\N	\N	0	f	\N	\N	\N
66	hany.gaber@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.394	\N	\N	\N	\N	0	f	\N	\N	\N
67	reham.sobhy@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.396	\N	\N	\N	\N	0	f	\N	\N	\N
68	tarek.osman@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.397	\N	\N	\N	\N	0	f	\N	\N	\N
69	mervat.aziz@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.398	\N	\N	\N	\N	0	f	\N	\N	\N
70	tarek.youssef.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.4	\N	\N	\N	\N	0	f	\N	\N	\N
71	dina.samir.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.401	\N	\N	\N	\N	0	f	\N	\N	\N
72	adel.fahmy@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.403	\N	\N	\N	\N	0	f	\N	\N	\N
73	shaimaa.gouda@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.404	\N	\N	\N	\N	0	f	\N	\N	\N
74	ramzy.halim@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.406	\N	\N	\N	\N	0	f	\N	\N	\N
378	student9@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.592	\N	\N	\N	\N	0	f	\N	\N	\N
379	student10@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.595	\N	\N	\N	\N	0	f	\N	\N	\N
380	student11@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.597	\N	\N	\N	\N	0	f	\N	\N	\N
381	student12@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.599	\N	\N	\N	\N	0	f	\N	\N	\N
382	student13@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.601	\N	\N	\N	\N	0	f	\N	\N	\N
383	student14@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.604	\N	\N	\N	\N	0	f	\N	\N	\N
384	student15@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.607	\N	\N	\N	\N	0	f	\N	\N	\N
385	student16@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.61	\N	\N	\N	\N	0	f	\N	\N	\N
386	student17@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.612	\N	\N	\N	\N	0	f	\N	\N	\N
387	student18@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.614	\N	\N	\N	\N	0	f	\N	\N	\N
388	student19@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.616	\N	\N	\N	\N	0	f	\N	\N	\N
55	dalia.ragab@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.377	\N	\N	\N	\N	0	f	\N	\N	\N
56	samir.lotfy@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.379	\N	\N	\N	\N	0	f	\N	\N	\N
57	noha.adel@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.381	\N	\N	\N	\N	0	f	\N	\N	\N
58	omar.khaled.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.382	\N	\N	\N	\N	0	f	\N	\N	\N
59	heba.said.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.384	\N	\N	\N	\N	0	f	\N	\N	\N
60	ashraf.zidan@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.385	\N	\N	\N	\N	0	f	\N	\N	\N
61	iman.fouad@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.387	\N	\N	\N	\N	0	f	\N	\N	\N
62	wael.barakat@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.388	\N	\N	\N	\N	0	f	\N	\N	\N
63	suzanne.makram@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.39	\N	\N	\N	\N	0	f	\N	\N	\N
75	fatma.ismail@university.edu	$2b$10$nbKR6zXu3y6m8UMrF44HJuIUk3G4ZCTmCqwL.nTAtl/HEZB/FeWmO	DOCTOR	2026-06-22 17:47:04.407	\N	\N	\N	\N	0	f	\N	\N	\N
76	ahmed.zidan.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.408	\N	\N	\N	\N	0	f	\N	\N	\N
77	salma.fouad.ta@university.edu	$2b$10$ebUAq63.OIP4E6dUc4iuVOLUTzRoNt/q2aUY5ZDU.HYfyaga.YOgu	TEACHING_ASSISTANT	2026-06-22 17:47:04.41	\N	\N	\N	\N	0	f	\N	\N	\N
463	dr.karim.saad@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.258	\N	\N	\N	\N	0	f	\N	\N	\N
370	student1@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.566	\N	\N	\N	\N	0	f	\N	\N	\N
371	student2@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.573	\N	\N	\N	\N	0	f	\N	\N	\N
372	student3@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.575	\N	\N	\N	\N	0	f	\N	\N	\N
373	student4@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.578	\N	\N	\N	\N	0	f	\N	\N	\N
389	student20@university.edu	$2b$10$K9m/xQNxfomSah0IN1mkO.Tbx7o9azD0KsoUzc1bhuUEZBsW3nt26	STUDENT	2026-06-22 21:54:47.618	\N	\N	\N	\N	0	f	\N	\N	\N
3	college.admin@university.com	$2b$10$/nnupoSWKMPWSI/KxIVWRuWakJ/OfZLIC0fh.RG08Dr8f0zhDf38O	COLLEGE_ADMIN	2026-06-22 17:47:04.019	\N	\N	\N	\N	0	f	\N	1	\N
464	dr.walid.hamdi@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.262	\N	\N	\N	\N	0	f	\N	\N	\N
465	dr.noha.rashad@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.264	\N	\N	\N	\N	0	f	\N	\N	\N
466	dr.fares.galal@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.266	\N	\N	\N	\N	0	f	\N	\N	\N
467	dr.iman.barakat@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.268	\N	\N	\N	\N	0	f	\N	\N	\N
468	dr.samer.adel@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.27	\N	\N	\N	\N	0	f	\N	\N	\N
469	dr.reem.khalifa@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.272	\N	\N	\N	\N	0	f	\N	\N	\N
470	dr.tamer.sobhi@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.274	\N	\N	\N	\N	0	f	\N	\N	\N
471	dr.doaa.mansour@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.276	\N	\N	\N	\N	0	f	\N	\N	\N
472	dr.nabil.ezz@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.278	\N	\N	\N	\N	0	f	\N	\N	\N
473	dr.wael.hafez@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.281	\N	\N	\N	\N	0	f	\N	\N	\N
474	dr.amira.sadek@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.283	\N	\N	\N	\N	0	f	\N	\N	\N
475	dr.sherif.anwar@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.284	\N	\N	\N	\N	0	f	\N	\N	\N
476	dr.lobna.gamal@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.286	\N	\N	\N	\N	0	f	\N	\N	\N
477	dr.adel.kamal@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.288	\N	\N	\N	\N	0	f	\N	\N	\N
478	dr.maha.salah@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.29	\N	\N	\N	\N	0	f	\N	\N	\N
479	dr.ziad.fawzy@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.292	\N	\N	\N	\N	0	f	\N	\N	\N
480	dr.ghada.nour@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.295	\N	\N	\N	\N	0	f	\N	\N	\N
481	dr.bassem.ramzy@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.296	\N	\N	\N	\N	0	f	\N	\N	\N
482	dr.donia.mahmoud@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	DOCTOR	2026-06-22 22:04:53.298	\N	\N	\N	\N	0	f	\N	\N	\N
483	ta.mahmoud.ict@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.385	\N	\N	\N	\N	0	f	\N	\N	\N
484	ta.yasmine.ict@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.387	\N	\N	\N	\N	0	f	\N	\N	\N
485	ta.bassem.ict@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.389	\N	\N	\N	\N	0	f	\N	\N	\N
486	ta.kareem.mech@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.391	\N	\N	\N	\N	0	f	\N	\N	\N
487	ta.nermeen.mech@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.394	\N	\N	\N	\N	0	f	\N	\N	\N
488	ta.taha.mech@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.396	\N	\N	\N	\N	0	f	\N	\N	\N
489	ta.lina.re@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.398	\N	\N	\N	\N	0	f	\N	\N	\N
490	ta.ahmed.re@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.4	\N	\N	\N	\N	0	f	\N	\N	\N
491	ta.rasha.re@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.402	\N	\N	\N	\N	0	f	\N	\N	\N
492	ta.abeer.nur@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.403	\N	\N	\N	\N	0	f	\N	\N	\N
493	ta.walaa.nur@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.405	\N	\N	\N	\N	0	f	\N	\N	\N
494	ta.osama.nur@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.407	\N	\N	\N	\N	0	f	\N	\N	\N
495	ta.enas.mlt@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.409	\N	\N	\N	\N	0	f	\N	\N	\N
496	ta.moustafa.mlt@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.411	\N	\N	\N	\N	0	f	\N	\N	\N
497	ta.shady.mlt@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.413	\N	\N	\N	\N	0	f	\N	\N	\N
498	ta.younis.rlw@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.414	\N	\N	\N	\N	0	f	\N	\N	\N
499	ta.nihal.rlw@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.416	\N	\N	\N	\N	0	f	\N	\N	\N
500	ta.sameh.rlw@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.418	\N	\N	\N	\N	0	f	\N	\N	\N
501	ta.alaa.aut@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.419	\N	\N	\N	\N	0	f	\N	\N	\N
502	ta.dena.aut@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.421	\N	\N	\N	\N	0	f	\N	\N	\N
503	ta.khaled.aut@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.423	\N	\N	\N	\N	0	f	\N	\N	\N
504	ta.mervat.ems@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.425	\N	\N	\N	\N	0	f	\N	\N	\N
505	ta.tarek.ems@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.427	\N	\N	\N	\N	0	f	\N	\N	\N
506	ta.hana.ems@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.429	\N	\N	\N	\N	0	f	\N	\N	\N
507	ta.ramy.pro@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.431	\N	\N	\N	\N	0	f	\N	\N	\N
508	ta.soha.pro@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.433	\N	\N	\N	\N	0	f	\N	\N	\N
509	ta.amir.pro@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.435	\N	\N	\N	\N	0	f	\N	\N	\N
510	ta.ghalia.rad@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.436	\N	\N	\N	\N	0	f	\N	\N	\N
511	ta.manar.rad@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.438	\N	\N	\N	\N	0	f	\N	\N	\N
512	ta.sherihan.rad@university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	TEACHING_ASSISTANT	2026-06-22 22:04:53.44	\N	\N	\N	\N	0	f	\N	\N	\N
513	ict.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.443	\N	\N	\N	\N	0	f	\N	\N	\N
514	ict.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.457	\N	\N	\N	\N	0	f	\N	\N	\N
515	ict.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.471	\N	\N	\N	\N	0	f	\N	\N	\N
516	ict.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.484	\N	\N	\N	\N	0	f	\N	\N	\N
517	ict.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.498	\N	\N	\N	\N	0	f	\N	\N	\N
518	ict.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.515	\N	\N	\N	\N	0	f	\N	\N	\N
519	ict.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.529	\N	\N	\N	\N	0	f	\N	\N	\N
520	ict.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.543	\N	\N	\N	\N	0	f	\N	\N	\N
521	ict.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.556	\N	\N	\N	\N	0	f	\N	\N	\N
522	ict.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.57	\N	\N	\N	\N	0	f	\N	\N	\N
523	mec.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.584	\N	\N	\N	\N	0	f	\N	\N	\N
524	mec.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.596	\N	\N	\N	\N	0	f	\N	\N	\N
525	mec.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.606	\N	\N	\N	\N	0	f	\N	\N	\N
526	mec.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.618	\N	\N	\N	\N	0	f	\N	\N	\N
527	mec.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.63	\N	\N	\N	\N	0	f	\N	\N	\N
528	mec.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.641	\N	\N	\N	\N	0	f	\N	\N	\N
529	mec.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.652	\N	\N	\N	\N	0	f	\N	\N	\N
530	mec.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.664	\N	\N	\N	\N	0	f	\N	\N	\N
531	mec.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.675	\N	\N	\N	\N	0	f	\N	\N	\N
532	mec.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.687	\N	\N	\N	\N	0	f	\N	\N	\N
533	ren.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.7	\N	\N	\N	\N	0	f	\N	\N	\N
534	ren.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.713	\N	\N	\N	\N	0	f	\N	\N	\N
535	ren.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.725	\N	\N	\N	\N	0	f	\N	\N	\N
536	ren.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.737	\N	\N	\N	\N	0	f	\N	\N	\N
537	ren.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.749	\N	\N	\N	\N	0	f	\N	\N	\N
538	ren.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.762	\N	\N	\N	\N	0	f	\N	\N	\N
539	ren.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.774	\N	\N	\N	\N	0	f	\N	\N	\N
540	ren.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.788	\N	\N	\N	\N	0	f	\N	\N	\N
541	ren.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.8	\N	\N	\N	\N	0	f	\N	\N	\N
542	ren.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.813	\N	\N	\N	\N	0	f	\N	\N	\N
543	nur.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.824	\N	\N	\N	\N	0	f	\N	\N	\N
544	nur.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.837	\N	\N	\N	\N	0	f	\N	\N	\N
545	nur.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.849	\N	\N	\N	\N	0	f	\N	\N	\N
546	nur.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.861	\N	\N	\N	\N	0	f	\N	\N	\N
547	nur.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.872	\N	\N	\N	\N	0	f	\N	\N	\N
548	nur.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.883	\N	\N	\N	\N	0	f	\N	\N	\N
549	nur.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.894	\N	\N	\N	\N	0	f	\N	\N	\N
550	nur.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.904	\N	\N	\N	\N	0	f	\N	\N	\N
551	nur.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.915	\N	\N	\N	\N	0	f	\N	\N	\N
552	nur.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.927	\N	\N	\N	\N	0	f	\N	\N	\N
553	med.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.939	\N	\N	\N	\N	0	f	\N	\N	\N
554	med.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.951	\N	\N	\N	\N	0	f	\N	\N	\N
555	med.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.964	\N	\N	\N	\N	0	f	\N	\N	\N
556	med.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.978	\N	\N	\N	\N	0	f	\N	\N	\N
557	med.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:53.99	\N	\N	\N	\N	0	f	\N	\N	\N
558	med.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.002	\N	\N	\N	\N	0	f	\N	\N	\N
559	med.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.015	\N	\N	\N	\N	0	f	\N	\N	\N
560	med.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.025	\N	\N	\N	\N	0	f	\N	\N	\N
561	med.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.038	\N	\N	\N	\N	0	f	\N	\N	\N
562	med.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.05	\N	\N	\N	\N	0	f	\N	\N	\N
563	rlw.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.062	\N	\N	\N	\N	0	f	\N	\N	\N
564	rlw.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.071	\N	\N	\N	\N	0	f	\N	\N	\N
565	rlw.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.08	\N	\N	\N	\N	0	f	\N	\N	\N
566	rlw.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.089	\N	\N	\N	\N	0	f	\N	\N	\N
567	rlw.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.099	\N	\N	\N	\N	0	f	\N	\N	\N
568	rlw.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.108	\N	\N	\N	\N	0	f	\N	\N	\N
569	rlw.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.118	\N	\N	\N	\N	0	f	\N	\N	\N
570	rlw.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.128	\N	\N	\N	\N	0	f	\N	\N	\N
571	rlw.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.136	\N	\N	\N	\N	0	f	\N	\N	\N
572	rlw.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.146	\N	\N	\N	\N	0	f	\N	\N	\N
573	aut.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.155	\N	\N	\N	\N	0	f	\N	\N	\N
574	aut.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.165	\N	\N	\N	\N	0	f	\N	\N	\N
575	aut.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.174	\N	\N	\N	\N	0	f	\N	\N	\N
576	aut.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.185	\N	\N	\N	\N	0	f	\N	\N	\N
577	aut.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.195	\N	\N	\N	\N	0	f	\N	\N	\N
578	aut.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.203	\N	\N	\N	\N	0	f	\N	\N	\N
579	aut.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.214	\N	\N	\N	\N	0	f	\N	\N	\N
580	aut.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.223	\N	\N	\N	\N	0	f	\N	\N	\N
581	aut.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.233	\N	\N	\N	\N	0	f	\N	\N	\N
582	aut.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.242	\N	\N	\N	\N	0	f	\N	\N	\N
583	ems.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.252	\N	\N	\N	\N	0	f	\N	\N	\N
584	ems.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.263	\N	\N	\N	\N	0	f	\N	\N	\N
585	ems.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.273	\N	\N	\N	\N	0	f	\N	\N	\N
586	ems.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.285	\N	\N	\N	\N	0	f	\N	\N	\N
587	ems.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.296	\N	\N	\N	\N	0	f	\N	\N	\N
588	ems.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.305	\N	\N	\N	\N	0	f	\N	\N	\N
589	ems.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.316	\N	\N	\N	\N	0	f	\N	\N	\N
590	ems.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.326	\N	\N	\N	\N	0	f	\N	\N	\N
591	ems.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.336	\N	\N	\N	\N	0	f	\N	\N	\N
592	ems.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.347	\N	\N	\N	\N	0	f	\N	\N	\N
593	pro.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.358	\N	\N	\N	\N	0	f	\N	\N	\N
594	pro.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.367	\N	\N	\N	\N	0	f	\N	\N	\N
595	pro.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.377	\N	\N	\N	\N	0	f	\N	\N	\N
596	pro.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.386	\N	\N	\N	\N	0	f	\N	\N	\N
597	pro.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.395	\N	\N	\N	\N	0	f	\N	\N	\N
598	pro.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.404	\N	\N	\N	\N	0	f	\N	\N	\N
599	pro.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.414	\N	\N	\N	\N	0	f	\N	\N	\N
600	pro.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.423	\N	\N	\N	\N	0	f	\N	\N	\N
601	pro.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.433	\N	\N	\N	\N	0	f	\N	\N	\N
602	pro.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.442	\N	\N	\N	\N	0	f	\N	\N	\N
603	rad.1@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.453	\N	\N	\N	\N	0	f	\N	\N	\N
604	rad.2@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.463	\N	\N	\N	\N	0	f	\N	\N	\N
605	rad.3@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.471	\N	\N	\N	\N	0	f	\N	\N	\N
606	rad.4@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.482	\N	\N	\N	\N	0	f	\N	\N	\N
607	rad.5@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.491	\N	\N	\N	\N	0	f	\N	\N	\N
608	rad.6@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.502	\N	\N	\N	\N	0	f	\N	\N	\N
609	rad.7@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.513	\N	\N	\N	\N	0	f	\N	\N	\N
610	rad.8@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.522	\N	\N	\N	\N	0	f	\N	\N	\N
611	rad.9@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.533	\N	\N	\N	\N	0	f	\N	\N	\N
612	rad.10@student.university.edu	$2b$10$BHTJdx1QHyGlRgxGzW3cn.zHbgsf5ZYnfLYQacMWRogm/zIDJWSt6	STUDENT	2026-06-22 22:04:54.542	\N	\N	\N	\N	0	f	\N	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
bbc522a6-a78a-4158-9024-f13359572eeb	8bef4f810afcd6d58d4b18c92bad3e2c612c0d34c69dd3d40df4b18d8b3ecfa1	2026-06-22 20:00:28.225884+03	20260621052234_add_teaching_assistant	\N	\N	2026-06-22 20:00:28.224426+03	1
6b8e57cb-809c-49fc-8216-ae27e3268721	6899c349beb29d682f0ae0a41b0fc63c165814adfea2c9c48520bb18e99bfcbd	2026-06-22 20:00:28.037275+03	20260426221425_init	\N	\N	2026-06-22 20:00:28.01532+03	1
f126a362-f482-4cbd-8f1c-d9d628a7a47e	de49042515338cc5951eade4e70bd949f809cc222328fb886bee44faac10f2da	2026-06-22 20:00:28.181362+03	20260606140000_add_attendance_unique_constraint	\N	\N	2026-06-22 20:00:28.17907+03	1
0265d894-ce31-4ba5-a34e-95677531ecac	108f5b91856578b6021df6f78427da5a1d613ffa301d638752a2dcb2e78a6a9d	2026-06-22 20:00:28.044244+03	20260426225601_add_courses	\N	\N	2026-06-22 20:00:28.037813+03	1
f51b7091-b180-4a4c-a3e7-eee9a829d377	e98a735357630fc60d66e5398fabff758b11b2de80096eec86b8ff2797b389a6	2026-06-22 20:00:28.054732+03	20260426230225_add_schedules_exams	\N	\N	2026-06-22 20:00:28.044685+03	1
3fe8fdeb-0006-41d6-a989-fc754d54d802	1c85b3765d5324d6fbe2f5b8eb29485e3d47c65d0556aca9955f5dd6a5d46f33	2026-06-22 20:00:28.060858+03	20260426230838_add_payments	\N	\N	2026-06-22 20:00:28.055221+03	1
9ab224dc-ac0a-4d6d-aa62-a90198da9fe8	1550bda2b20f8f5e9f5f16d853d78f092b8554228ddb61156fb54333d1ab5b61	2026-06-22 20:00:28.188698+03	20260606140100_fix_payment_amount_decimal	\N	\N	2026-06-22 20:00:28.18176+03	1
e19dbf08-f099-4338-a5d4-a3812e7f4d27	28767ca72c6ad9a1141fb20729bd9ebd434d3aa5ef7e179634a864b4fe20e029	2026-06-22 20:00:28.100052+03	20260426233246_major_upgrade	\N	\N	2026-06-22 20:00:28.06131+03	1
72304f0b-b46f-485b-a39a-a549c9240e3b	8370fabd626a7afef17abed26e42873a042f9b876959fc9e37af96bcd6a7fbfe	2026-06-22 20:00:28.102723+03	20260426233932_add_course_year_semester	\N	\N	2026-06-22 20:00:28.100547+03	1
9210e25f-f7d9-4f9c-a6f1-fa9dd195f1c7	84fc57213027abda6da3b570cdc837fa4a5c8c91c1ba8d5b74791079c36ac78e	2026-06-22 20:00:28.108705+03	20260427110302_add_student_courses_relation	\N	\N	2026-06-22 20:00:28.103206+03	1
bf0869fc-e08e-4aa8-9e41-7e64c4f80d15	b395fb45d821ecbf5bc655fa7e919d202ec2e0e48ae205a8d486b1ec3e6c3d35	2026-06-22 20:00:28.191475+03	20260612_add_managed_college	\N	\N	2026-06-22 20:00:28.189224+03	1
8600249c-a196-499d-b60b-b28e1b3d2197	92d2ef93803b49651649af164008bab5745c495af9d74005a67420d6b1bdaa85	2026-06-22 20:00:28.114843+03	20260428111816_add_notifications_and_profile_pic	\N	\N	2026-06-22 20:00:28.109132+03	1
938e4298-f812-496e-9986-4f5cd23ff1ff	6d4de48777844e21d76d7eea64c4ed24d5d186df0d4bec2b03b8a879933fae6c	2026-06-22 20:00:28.117868+03	20260428131910_add_admin_scopes	\N	\N	2026-06-22 20:00:28.115263+03	1
460cf66e-b963-48ac-bdc0-1349996b918c	fc58272c8c612ec0885483bb7c6badc13d1ee70f95bce55d6efd3b9733d16428	2026-06-22 20:00:28.228016+03	20260621062510_add_notifications	\N	\N	2026-06-22 20:00:28.226284+03	1
82299247-522b-48c0-be80-37f161719f3e	cc3672bf742f04b87a6c356f513ee2ddb4c5523209d0e3127d9d6dcef6f07f79	2026-06-22 20:00:28.119725+03	20260601120000_sync_exam_and_registration_phone	\N	\N	2026-06-22 20:00:28.118277+03	1
77dc77ff-e04e-410d-962f-9e36a454e596	6c90ffbba90ac161edad499647037c0ced455bfd9b3311dc6ab46dfdac967e90	2026-06-22 20:00:28.199118+03	20260613223923_add_managed_college	\N	\N	2026-06-22 20:00:28.191866+03	1
1dffe06a-7c9a-4fac-a163-a422a872d905	4ebf4395ea19c860beb0bcca1407a6cc5cb88a445521dfae4aa073729e1ef81a	2026-06-22 20:00:28.165996+03	20260606123349_add_2fa_secret	\N	\N	2026-06-22 20:00:28.120269+03	1
a0cadcad-543d-4332-95dc-1fa1a3e105f8	b81c8c7e7f173065b8819ccb130e07abf2b6d0b9ff8ba279b6e2c6635b4139e9	2026-06-22 20:00:28.176799+03	20260606124527_add_refresh_token	\N	\N	2026-06-22 20:00:28.166508+03	1
e6bf9a98-57ba-4270-89a4-d0d2dba8cd74	f8a8c9b638ae3a9325d0a19f61b9451850ec04493c5793a3ff1f02b97cdffc60	2026-06-22 20:00:28.17869+03	20260606130000_add_rejection_reason	\N	\N	2026-06-22 20:00:28.177254+03	1
30b84c1d-2340-4e0f-b375-1ef9a9d29f20	beead171ad2cc99a608d461e2df45ddee5b586383961be4d90a394678b6805c4	2026-06-22 20:00:28.201511+03	20260613231111_add_role_hierarchy	\N	\N	2026-06-22 20:00:28.199523+03	1
394e0858-40ec-469f-a186-15e7f86b16bc	073316c195e2983be5310fdbcfdf508bedd309066871bcdb1b6aa15955595105	2026-06-22 20:00:28.211967+03	20260617105554_add_enrollment_model	\N	\N	2026-06-22 20:00:28.202049+03	1
56d070ab-84e2-4fb5-ab6c-a20c154ad2f8	64155895a390de8a4caa1d79fb7feb7e56c2c275e981e71a00bac72ada46bd64	2026-06-22 20:00:28.231131+03	20260621190900_add_course_name_ar	\N	\N	2026-06-22 20:00:28.228583+03	1
b52156d0-a827-49a7-a90c-8e946d7c65c4	8bef4f810afcd6d58d4b18c92bad3e2c612c0d34c69dd3d40df4b18d8b3ecfa1	2026-06-22 20:00:28.213996+03	20260617105713_fix_sequence	\N	\N	2026-06-22 20:00:28.212368+03	1
e5aebe6e-8525-40cd-a4b1-4e145b4a4295	160f2f5d091d287ad2cf21d63ddeb06ea6ce0f34caec26eb25376bc11fefac67	2026-06-22 20:00:28.223992+03	20260620202121_add_teaching_assistant	\N	\N	2026-06-22 20:00:28.214399+03	1
6f1ea562-a821-4111-b549-f31c1e5d11c3	2a2e49ec37d7e1ad54af76d13473299459ec1b810a29d397dec7ee2ba2801a61	2026-06-22 20:00:34.217547+03	20260622170034_add_college_description_ar	\N	\N	2026-06-22 20:00:34.214552+03	1
4e8ea826-ac7a-4aa8-941b-bc7fc0d3c608	dd879d4cb700c41427e049fbce0367ca2e48155ae727861d00c563cfe5154a95	2026-06-22 23:20:35.682489+03	20260622202035_add_online_exam_system	\N	\N	2026-06-22 23:20:35.640235+03	1
c7af5332-166c-4a9e-97b4-f3959e622c24	af2425e46d1815c28380af354f688be918c33c55640d16b91faf2dc0bbf2488b	2026-06-22 23:51:09.394296+03	20260622205109_add_exam_violations	\N	\N	2026-06-22 23:51:09.380161+03	1
\.


--
-- Name: Attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Attendance_id_seq"', 1, false);


--
-- Name: AuditLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AuditLog_id_seq"', 1, false);


--
-- Name: College_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."College_id_seq"', 1, false);


--
-- Name: Course_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Course_id_seq"', 99, true);


--
-- Name: Department_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Department_id_seq"', 1, false);


--
-- Name: Doctor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Doctor_id_seq"', 280, true);


--
-- Name: Enrollment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Enrollment_id_seq"', 807, true);


--
-- Name: ExamAnswer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ExamAnswer_id_seq"', 1, false);


--
-- Name: ExamQuestion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ExamQuestion_id_seq"', 1, false);


--
-- Name: ExamSession_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ExamSession_id_seq"', 1, false);


--
-- Name: ExamSubmission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ExamSubmission_id_seq"', 1, false);


--
-- Name: ExamViolation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ExamViolation_id_seq"', 1, false);


--
-- Name: Exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Exam_id_seq"', 30, true);


--
-- Name: Notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Notification_id_seq"', 1, false);


--
-- Name: Payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Payment_id_seq"', 1, false);


--
-- Name: Question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Question_id_seq"', 20, true);


--
-- Name: QuizSubmission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."QuizSubmission_id_seq"', 1, false);


--
-- Name: Quiz_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Quiz_id_seq"', 5, true);


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 3, true);


--
-- Name: RegistrationRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RegistrationRequest_id_seq"', 1, false);


--
-- Name: Schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Schedule_id_seq"', 160, true);


--
-- Name: StudentSuccessMetric_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."StudentSuccessMetric_id_seq"', 1, false);


--
-- Name: Student_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Student_id_seq"', 126, true);


--
-- Name: TaskSubmission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."TaskSubmission_id_seq"', 1, false);


--
-- Name: Task_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Task_id_seq"', 1, false);


--
-- Name: TeachingAssistant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."TeachingAssistant_id_seq"', 174, true);


--
-- Name: Timetable_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Timetable_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 612, true);


--
-- Name: doctor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.doctor_id_seq', 13, true);


--
-- Name: Attendance Attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: College College_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."College"
    ADD CONSTRAINT "College_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: Doctor Doctor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Doctor"
    ADD CONSTRAINT "Doctor_pkey" PRIMARY KEY (id);


--
-- Name: Enrollment Enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_pkey" PRIMARY KEY (id);


--
-- Name: ExamAnswer ExamAnswer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamAnswer"
    ADD CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY (id);


--
-- Name: ExamQuestion ExamQuestion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY (id);


--
-- Name: ExamSession ExamSession_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSession"
    ADD CONSTRAINT "ExamSession_pkey" PRIMARY KEY (id);


--
-- Name: ExamSubmission ExamSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSubmission"
    ADD CONSTRAINT "ExamSubmission_pkey" PRIMARY KEY (id);


--
-- Name: ExamViolation ExamViolation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamViolation"
    ADD CONSTRAINT "ExamViolation_pkey" PRIMARY KEY (id);


--
-- Name: Exam Exam_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Question Question_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_pkey" PRIMARY KEY (id);


--
-- Name: QuizSubmission QuizSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuizSubmission"
    ADD CONSTRAINT "QuizSubmission_pkey" PRIMARY KEY (id);


--
-- Name: Quiz Quiz_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quiz"
    ADD CONSTRAINT "Quiz_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: RegistrationRequest RegistrationRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegistrationRequest"
    ADD CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY (id);


--
-- Name: Schedule Schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Schedule"
    ADD CONSTRAINT "Schedule_pkey" PRIMARY KEY (id);


--
-- Name: StudentSuccessMetric StudentSuccessMetric_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StudentSuccessMetric"
    ADD CONSTRAINT "StudentSuccessMetric_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: TaskSubmission TaskSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskSubmission"
    ADD CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TeachingAssistant TeachingAssistant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeachingAssistant"
    ADD CONSTRAINT "TeachingAssistant_pkey" PRIMARY KEY (id);


--
-- Name: Timetable Timetable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Attendance_courseId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Attendance_courseId_date_idx" ON public."Attendance" USING btree ("courseId", date);


--
-- Name: Attendance_studentId_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Attendance_studentId_courseId_idx" ON public."Attendance" USING btree ("studentId", "courseId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_entity_entityId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_entity_entityId_idx" ON public."AuditLog" USING btree (entity, "entityId");


--
-- Name: AuditLog_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_timestamp_idx" ON public."AuditLog" USING btree ("timestamp");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: Course_courseCode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Course_courseCode_idx" ON public."Course" USING btree ("courseCode");


--
-- Name: Course_courseCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Course_courseCode_key" ON public."Course" USING btree ("courseCode");


--
-- Name: Course_departmentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Course_departmentId_idx" ON public."Course" USING btree ("departmentId");


--
-- Name: Course_doctorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Course_doctorId_idx" ON public."Course" USING btree ("doctorId");


--
-- Name: Department_collegeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Department_collegeId_idx" ON public."Department" USING btree ("collegeId");


--
-- Name: Doctor_departmentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Doctor_departmentId_idx" ON public."Doctor" USING btree ("departmentId");


--
-- Name: Doctor_doctorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Doctor_doctorId_idx" ON public."Doctor" USING btree ("doctorId");


--
-- Name: Doctor_doctorId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Doctor_doctorId_key" ON public."Doctor" USING btree ("doctorId");


--
-- Name: Doctor_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Doctor_userId_key" ON public."Doctor" USING btree ("userId");


--
-- Name: Enrollment_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Enrollment_courseId_idx" ON public."Enrollment" USING btree ("courseId");


--
-- Name: Enrollment_studentId_courseId_semester_academicYear_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Enrollment_studentId_courseId_semester_academicYear_key" ON public."Enrollment" USING btree ("studentId", "courseId", semester, "academicYear");


--
-- Name: Enrollment_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Enrollment_studentId_idx" ON public."Enrollment" USING btree ("studentId");


--
-- Name: ExamAnswer_submissionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamAnswer_submissionId_idx" ON public."ExamAnswer" USING btree ("submissionId");


--
-- Name: ExamAnswer_submissionId_questionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ExamAnswer_submissionId_questionId_key" ON public."ExamAnswer" USING btree ("submissionId", "questionId");


--
-- Name: ExamQuestion_examSessionId_orderIndex_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamQuestion_examSessionId_orderIndex_idx" ON public."ExamQuestion" USING btree ("examSessionId", "orderIndex");


--
-- Name: ExamSession_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamSession_courseId_idx" ON public."ExamSession" USING btree ("courseId");


--
-- Name: ExamSession_doctorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamSession_doctorId_idx" ON public."ExamSession" USING btree ("doctorId");


--
-- Name: ExamSession_examId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ExamSession_examId_key" ON public."ExamSession" USING btree ("examId");


--
-- Name: ExamSession_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamSession_status_idx" ON public."ExamSession" USING btree (status);


--
-- Name: ExamSubmission_examSessionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamSubmission_examSessionId_idx" ON public."ExamSubmission" USING btree ("examSessionId");


--
-- Name: ExamSubmission_examSessionId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ExamSubmission_examSessionId_studentId_key" ON public."ExamSubmission" USING btree ("examSessionId", "studentId");


--
-- Name: ExamSubmission_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamSubmission_studentId_idx" ON public."ExamSubmission" USING btree ("studentId");


--
-- Name: ExamViolation_submissionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamViolation_submissionId_idx" ON public."ExamViolation" USING btree ("submissionId");


--
-- Name: ExamViolation_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ExamViolation_type_idx" ON public."ExamViolation" USING btree (type);


--
-- Name: Exam_courseId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Exam_courseId_date_idx" ON public."Exam" USING btree ("courseId", date);


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: Payment_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_createdAt_idx" ON public."Payment" USING btree ("createdAt");


--
-- Name: Payment_studentId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_studentId_status_idx" ON public."Payment" USING btree ("studentId", status);


--
-- Name: Question_quizId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Question_quizId_idx" ON public."Question" USING btree ("quizId");


--
-- Name: QuizSubmission_quizId_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "QuizSubmission_quizId_studentId_idx" ON public."QuizSubmission" USING btree ("quizId", "studentId");


--
-- Name: Quiz_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quiz_courseId_idx" ON public."Quiz" USING btree ("courseId");


--
-- Name: RefreshToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "RefreshToken_token_key" ON public."RefreshToken" USING btree (token);


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: RegistrationRequest_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RegistrationRequest_email_idx" ON public."RegistrationRequest" USING btree (email);


--
-- Name: RegistrationRequest_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "RegistrationRequest_email_key" ON public."RegistrationRequest" USING btree (email);


--
-- Name: RegistrationRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RegistrationRequest_status_idx" ON public."RegistrationRequest" USING btree (status);


--
-- Name: Schedule_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Schedule_courseId_idx" ON public."Schedule" USING btree ("courseId");


--
-- Name: StudentSuccessMetric_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "StudentSuccessMetric_studentId_key" ON public."StudentSuccessMetric" USING btree ("studentId");


--
-- Name: Student_departmentId_year_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Student_departmentId_year_idx" ON public."Student" USING btree ("departmentId", year);


--
-- Name: Student_firstName_lastName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Student_firstName_lastName_idx" ON public."Student" USING btree ("firstName", "lastName");


--
-- Name: Student_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Student_studentId_idx" ON public."Student" USING btree ("studentId");


--
-- Name: Student_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Student_studentId_key" ON public."Student" USING btree ("studentId");


--
-- Name: Student_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Student_userId_key" ON public."Student" USING btree ("userId");


--
-- Name: TaskSubmission_taskId_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TaskSubmission_taskId_studentId_idx" ON public."TaskSubmission" USING btree ("taskId", "studentId");


--
-- Name: Task_courseId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_courseId_idx" ON public."Task" USING btree ("courseId");


--
-- Name: TeachingAssistant_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TeachingAssistant_userId_key" ON public."TeachingAssistant" USING btree ("userId");


--
-- Name: Timetable_collegeId_departmentId_academicYear_semester_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Timetable_collegeId_departmentId_academicYear_semester_key" ON public."Timetable" USING btree ("collegeId", "departmentId", "academicYear", semester);


--
-- Name: Timetable_collegeId_departmentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Timetable_collegeId_departmentId_idx" ON public."Timetable" USING btree ("collegeId", "departmentId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: Attendance Attendance_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attendance Attendance_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Course Course_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Course Course_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public."Doctor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Department Department_collegeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public."College"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Doctor Doctor_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Doctor"
    ADD CONSTRAINT "Doctor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Doctor Doctor_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Doctor"
    ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Enrollment Enrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamAnswer ExamAnswer_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamAnswer"
    ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."ExamQuestion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamAnswer ExamAnswer_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamAnswer"
    ADD CONSTRAINT "ExamAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."ExamSubmission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamQuestion ExamQuestion_examSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES public."ExamSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSession ExamSession_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSession"
    ADD CONSTRAINT "ExamSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamSession ExamSession_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSession"
    ADD CONSTRAINT "ExamSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public."Doctor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamSession ExamSession_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSession"
    ADD CONSTRAINT "ExamSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES public."Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSubmission ExamSubmission_examSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSubmission"
    ADD CONSTRAINT "ExamSubmission_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES public."ExamSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSubmission ExamSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamSubmission"
    ADD CONSTRAINT "ExamSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamViolation ExamViolation_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExamViolation"
    ADD CONSTRAINT "ExamViolation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."ExamSubmission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Exam Exam_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Question Question_quizId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES public."Quiz"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuizSubmission QuizSubmission_quizId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuizSubmission"
    ADD CONSTRAINT "QuizSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES public."Quiz"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuizSubmission QuizSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuizSubmission"
    ADD CONSTRAINT "QuizSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quiz Quiz_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quiz"
    ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quiz Quiz_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quiz"
    ADD CONSTRAINT "Quiz_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public."Doctor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistrationRequest RegistrationRequest_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegistrationRequest"
    ADD CONSTRAINT "RegistrationRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Schedule Schedule_assistantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Schedule"
    ADD CONSTRAINT "Schedule_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES public."TeachingAssistant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Schedule Schedule_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Schedule"
    ADD CONSTRAINT "Schedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentSuccessMetric StudentSuccessMetric_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StudentSuccessMetric"
    ADD CONSTRAINT "StudentSuccessMetric_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Student Student_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Student Student_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskSubmission TaskSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskSubmission"
    ADD CONSTRAINT "TaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskSubmission TaskSubmission_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskSubmission"
    ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public."Doctor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TeachingAssistant TeachingAssistant_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeachingAssistant"
    ADD CONSTRAINT "TeachingAssistant_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TeachingAssistant TeachingAssistant_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeachingAssistant"
    ADD CONSTRAINT "TeachingAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Timetable Timetable_collegeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public."College"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Timetable Timetable_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_collegeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public."College"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_managedCollegeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_managedCollegeId_fkey" FOREIGN KEY ("managedCollegeId") REFERENCES public."College"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_managedDepartmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_managedDepartmentId_fkey" FOREIGN KEY ("managedDepartmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict NvMvKYB90RJesCHPrIqTWTdHigpVutZvcIJ98deofjIZ9CjfO54CHOC057UAZiJ

