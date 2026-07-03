// All user-facing text lives here so it's never hardcoded inside pages.
// Keys stay in English (so the code reads clearly); values are the displayed
// Hebrew. To add another language later, create a sibling file (e.g. en.ts)
// with the same shape and let the app choose between them.

export const labels = {
  site: {
    title: "מגנטים לאירועים",
    description: "פלטפורמה שבה אורחי האירוע מצלמים בעצמם ומקבלים מגנט מעוצב להדפסה",
  },
  home: {
    badge: "האתר בהקמה",
    heading: "מגנטים לאירועים",
    subheading:
      "הפלטפורמה שבה אורחי החתונה או המסיבה מצלמים בעצמם, בוחרים מסגרת מעוצבת — ואתם מקבלים מגנט מוכן להדפסה.",
  },
} as const;
