import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createStudentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  phone: z.string().optional().default(''),
  rollNo: z.string().optional().default(''),
  classId: objectId,
  sectionId: objectId,
  academicYearId: objectId.optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().default('other'),
  bloodGroup: z.string().optional().default(''),
  address: z.string().optional().default(''),
  guardianName: z.string().optional().default(''),
  guardianPhone: z.string().optional().default(''),
  parentEmail: z.string().email().optional().or(z.literal('')),
  parentName: z.string().optional().default(''),
  parentPhone: z.string().optional().default(''),
});

export const updateStudentSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  rollNo: z.string().optional(),
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  status: z.enum(['active', 'graduated', 'transferred', 'inactive']).optional(),
});

export const createFacultySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  phone: z.string().optional().default(''),
  employeeId: z.string().optional(),
  department: z.string().optional().default('General'),
  qualification: z.string().optional().default(''),
  designation: z.string().optional().default('Teacher'),
});

export const updateFacultySchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  qualification: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const classSchema = z.object({
  name: z.string().min(1),
  numericLevel: z.coerce.number().int().min(1).max(12),
  academicYearId: objectId.optional(),
});

export const sectionSchema = z.object({
  name: z.string().min(1),
  classId: objectId,
  classTeacherId: objectId.nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(200).optional().default(40),
});

export const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2),
  classId: objectId,
  sectionId: objectId.nullable().optional(),
  facultyId: objectId.nullable().optional(),
  maxMarks: z.coerce.number().min(1).optional().default(100),
  passMarks: z.coerce.number().min(0).optional().default(40),
  credits: z.coerce.number().min(0.5).optional().default(1),
});

export const academicYearSchema = z.object({
  name: z.string().min(4),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean().optional().default(false),
});

export const settingsSchema = z.object({
  schoolName: z.string().min(2).optional(),
  tagline: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logoUrl: z.string().optional(),
  currentAcademicYearId: objectId.nullable().optional(),
  attendanceThreshold: z.coerce.number().min(1).max(100).optional(),
  attendanceEditWindowHours: z.coerce.number().min(1).max(168).optional(),
  workingDays: z.array(z.string()).optional(),
  gradingScale: z
    .array(
      z.object({
        grade: z.string().min(1),
        minPercentage: z.coerce.number().min(0).max(100),
        maxPercentage: z.coerce.number().min(0).max(100),
        gpa: z.coerce.number().min(0).max(10),
        remark: z.string().optional().default(''),
      })
    )
    .optional(),
});
