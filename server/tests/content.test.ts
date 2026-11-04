import { describe, expect, it } from 'vitest'
import { lessons, modules } from '../../src/content/lessons'
import { lessonExtras } from '../../src/content/lessonExtras'
import { interviewQuestions } from '../../src/content/interviews'

const slugs = new Set(lessons.map((lesson) => lesson.slug))

describe('course content', () => {
  it('numbers lessons in curriculum order with unique slugs', () => {
    expect(slugs.size).toBe(lessons.length)
    expect(lessons.map((lesson) => Number(lesson.number))).toEqual(lessons.map((_, index) => index + 1))
    expect(lessons.map((lesson) => lesson.slug)).toEqual(modules.flatMap((module) => module.lessonSlugs))
  })

  it('has no empty or overstated modules', () => {
    for (const module of modules) {
      expect(module.lessonSlugs.length).toBeGreaterThan(0)
      expect(module.lessonCount).toBe(module.lessonSlugs.length)
    }
  })

  it.each(lessons.map((lesson) => [lesson.slug, lesson] as const))('%s is complete and consistent', (_slug, lesson) => {
    expect(lesson.sections.length).toBeGreaterThanOrEqual(3)
    expect(lesson.practice.length).toBeGreaterThanOrEqual(3)
    expect(lesson.objectives.length).toBeGreaterThanOrEqual(3)
    expect(lesson.quiz.answer).toBeGreaterThanOrEqual(0)
    expect(lesson.quiz.answer).toBeLessThan(lesson.quiz.options.length)
    expect(lesson.codeOutput, 'every example publishes verified output').toBeTruthy()
    expect(lesson.commonMistakes.length).toBeGreaterThanOrEqual(3)
    expect(lesson.furtherReading.length).toBeGreaterThanOrEqual(2)
    for (const reference of [...lesson.prerequisites, ...lesson.related]) expect(slugs, `${reference} must exist`).toContain(reference)
  })

  it('teaches prerequisites before the lessons that need them', () => {
    const position = new Map(lessons.map((lesson, index) => [lesson.slug, index]))
    for (const lesson of lessons) {
      for (const prerequisite of lesson.prerequisites) expect(position.get(prerequisite), `${prerequisite} before ${lesson.slug}`).toBeLessThan(position.get(lesson.slug)!)
    }
  })

  it('has no extras for lessons that do not exist', () => {
    for (const slug of Object.keys(lessonExtras)) expect(slugs).toContain(slug)
  })

  it('has unique interview questions with their own follow-ups', () => {
    expect(new Set(interviewQuestions.map((question) => question.title)).size).toBe(interviewQuestions.length)
    expect(new Set(interviewQuestions.map((question) => question.followUp)).size).toBe(interviewQuestions.length)
  })
})
