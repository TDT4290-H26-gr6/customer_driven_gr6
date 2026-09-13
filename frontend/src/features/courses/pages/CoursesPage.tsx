import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components/Spinner";
import { CourseCard } from "../components/CourseCard";
import { getCourses } from "../api";
import type { Course } from "../types";
import styles from "./CoursesPage.module.css";

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  // Only one card expanded at a time: picking another collapses the current
  // one, and the newly picked card is what pushes the next row down.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Available courses</h1>
      <p className={styles.subheading}>
        Courses and resources from partner institutions to help build your skills.
      </p>

      {courses === null ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <p className={styles.empty}>No courses are available yet.</p>
      ) : (
        <div className={styles.grid}>
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              expanded={expandedId === course.id}
              onToggle={() => setExpandedId((id) => (id === course.id ? null : course.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
