// MVP-specific LessonService to avoid conflicts with the existing complex LessonService.
// This service provides basic functionalities to fetch lesson content
// for the initial MVP requirements of the ConversationScreen.
// It uses the data structures and lesson definitions from src/data/lessons.ts.

import {
  Lesson,
  getLessonById as getCoreLessonByIdFromData,
  getMvpLessons as getAllMvpLessonsFromData,
  CORE_LESSONS
} from '../data/lessons';
import monitoring from '../config/monitoring';

class MvpLessonService {
  /**
   * Retrieves all defined MVP lessons.
   * @returns {Lesson[]} An array of MVP lessons.
   */
  public getMvpLessons(): Lesson[] {
    try {
      return getAllMvpLessonsFromData();
    } catch (error) {
      const err = error as Error;
      monitoring.logError({
        type: 'get_mvp_lessons_failed_mvpservice',
        error: err.message,
        details: err.stack,
      }).catch(console.error);
      return [];
    }
  }

  /**
   * Retrieves a specific lesson by its ID from the CORE_LESSONS.
   * @param {string} id - The ID of the lesson to retrieve.
   * @returns {Lesson | undefined} The lesson object if found, otherwise undefined.
   */
  public getLessonById(id: string): Lesson | undefined {
    try {
      return getCoreLessonByIdFromData(id);
    } catch (error) {
      const err = error as Error;
      monitoring.logError({
        type: 'get_lesson_by_id_failed_mvpservice',
        error: err.message,
        details: err.stack,
        context: { lessonId: id },
      }).catch(console.error);
      return undefined;
    }
  }

  /**
   * Retrieves all core lessons defined in the application.
   * @returns {Lesson[]} An array of all core lessons.
   */
  public getAllCoreLessons(): Lesson[] {
    try {
      return CORE_LESSONS;
    } catch (error) {
      const err = error as Error;
      monitoring.logError({
        type: 'get_all_core_lessons_failed_mvpservice',
        error: err.message,
        details: err.stack,
      }).catch(console.error);
      return [];
    }
  }
}

export default new MvpLessonService();
