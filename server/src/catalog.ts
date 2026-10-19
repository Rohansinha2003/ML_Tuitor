import { lessons, modules } from '../../src/content/lessons.ts'

export const lessonBySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]))
export const publishedLessonSlugs = new Set(lessonBySlug.keys())

export function findPublishedLesson(slug: string) {
  return lessonBySlug.get(slug)
}

export function getPublishedModules() {
  return modules.map((module) => ({
    id: module.id,
    title: module.title,
    shortTitle: module.shortTitle,
    level: module.level,
    lessonSlugs: module.lessonSlugs.filter((slug) => publishedLessonSlugs.has(slug)),
  }))
}
