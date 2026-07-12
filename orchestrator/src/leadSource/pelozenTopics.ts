/**
 * pelozen "תחום עניין" (interest) ids → Hebrew topic name, captured live from
 * the cold_data dropdown (select#interest_id). The cold_data page renders leads
 * across ALL topics with each card carrying its interest id (button.refresh
 * data-id), and the URL ?interest_id= param is ignored server-side — so the
 * scraper filters by these ids client-side.
 */
export const PELOZEN_TOPICS: Record<string, string> = {
  "76": "מתעניין לעבוד כסוכן בפה לאוזן",
  "529": "מתעניין בהלוואה לעסק",
  "296": "יעוץ עם עורך דין מקצועי לכל מטרה",
  "432": "בדיקת פיצוי כספי מפציעה או תאונה",
  "476": "מכירות - יס (YES) הצטרפות לכבלים",
  "532": "מכירות - הוט - טריפל כבלים",
  "538": "יעוץ עם עורך דין מקצועי - פייסבוק",
  "537": "יעוץ משפטי עורך דין איכותי - מאושרים",
  "540": "מכירות - עורכי דין חדשים - מעוניינים בפרסום",
  "545": "מכירות - גיוס סוכנים לפה לאוזן",
  "547": "מכירות - כתבות קידום לעסק",
  "549": "הלוואות לעסקים - מחזורים גבוהים",
  "555": "לימודים - תואר ראשון במשפטים/חינוך/מנהל עסקים",
  "559": "לימודים - יעוץ לכל סוגי הלימודים והקורסים",
  "561": "מגן משפטי",
  "563": "מתעניין בטריפל של הוט - חדש",
  "566": "הלוואות לעסקים - פה לאוזן",
  "568": "לימודים - כל תחומי הלימודים",
  "572": "יעוץ משפטי עם עורך דין - 2025",
  "574": "מתעניין בעורך דין - חדש",
  "575": "יעוץ משפטי עם עורך דין - NEW",
  "576": "טריפל של חברת HOT",
};

export function topicName(interestId: string): string {
  return PELOZEN_TOPICS[interestId] ?? `תחום ${interestId}`;
}
