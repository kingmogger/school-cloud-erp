import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { runWithTenant } from '../utils/tenantContext.js';

export const STANDARD_SUBJECTS = [
  { name: 'Maths', prefix: 'MATH' },
  { name: 'Social', prefix: 'SOC' },
  { name: 'Physics', prefix: 'PHY' },
  { name: 'Biology', prefix: 'BIO' },
  { name: 'Hindi', prefix: 'HIN' },
  { name: 'Telugu', prefix: 'TEL' },
];

export async function provisionStandardClassesAndSubjects(schoolId, academicYearId = null) {
  return runWithTenant(schoolId, async () => {
    let ayId = academicYearId;
    if (!ayId) {
      let ay = await AcademicYear.findOne({ isCurrent: true }).lean();
      if (!ay) {
        ay = await AcademicYear.create({
          schoolId: String(schoolId),
          name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          startDate: new Date(`${new Date().getFullYear()}-04-01`),
          endDate: new Date(`${new Date().getFullYear() + 1}-03-31`),
          isCurrent: true,
        });
      }
      ayId = ay._id;
    }

    let classesCreated = 0;
    let sectionsCreated = 0;
    let subjectsCreated = 0;

    for (let level = 1; level <= 10; level += 1) {
      const className = `Class ${level}`;
      let cls = await Class.findOne({ numericLevel: level }).lean();
      if (!cls) {
        cls = await Class.findOne({ name: className }).lean();
      }
      if (!cls) {
        cls = await Class.create({
          schoolId: String(schoolId),
          name: className,
          numericLevel: level,
          academicYearId: ayId,
        });
        classesCreated += 1;
      }

      const existingSection = await Section.findOne({ classId: cls._id }).lean();
      if (!existingSection) {
        await Section.create({
          schoolId: String(schoolId),
          name: 'A',
          classId: cls._id,
          capacity: 40,
        });
        sectionsCreated += 1;
      }

      for (const subj of STANDARD_SUBJECTS) {
        const code = `${subj.prefix}${level}`;
        const existingSub = await Subject.findOne({
          classId: cls._id,
          name: subj.name,
        }).lean();
        if (!existingSub) {
          await Subject.create({
            schoolId: String(schoolId),
            name: subj.name,
            code,
            classId: cls._id,
            maxMarks: 100,
            passMarks: 35,
            credits: 1,
          });
          subjectsCreated += 1;
        }
      }
    }

    return { classesCreated, sectionsCreated, subjectsCreated };
  });
}
