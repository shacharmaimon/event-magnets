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
  admin: {
    loginTitle: "כניסת מנהל",
    loginSubtitle: "התחברו כדי לנהל את האירועים שלכם",
    emailLabel: "אימייל",
    passwordLabel: "סיסמה",
    loginButton: "התחברות",
    loggingIn: "מתחבר...",
    loginError: "האימייל או הסיסמה שגויים",
    dashboardTitle: "לוח הבקרה",
    welcomeBack: "שלום",
    logout: "התנתקות",
    loading: "טוען...",
  },
  adminEvents: {
    pageTitle: "האירועים שלי",
    newEvent: "אירוע חדש",
    noEvents: "עדיין אין אירועים. צרו את הראשון!",
    open: "פתוח",
    closed: "סגור",
    createdAt: "נוצר בתאריך",
    manage: "ניהול",
    loadError: "טעינת האירועים נכשלה",
    // form
    createTitle: "יצירת אירוע",
    editTitle: "עריכת אירוע",
    nameLabel: "שם האירוע",
    welcomeHeadingLabel: "כותרת מסך הפתיחה",
    welcomeSubheadingLabel: "כותרת משנה",
    photosPerDeviceLabel: "מספר תמונות למכשיר",
    create: "יצירה",
    creating: "יוצר...",
    save: "שמירה",
    saving: "שומר...",
    saveError: "השמירה נכשלה",
    back: "חזרה",
    // manage page
    toggleToOpen: "פתיחת האירוע",
    toggleToClosed: "סגירת האירוע",
    statusLabel: "סטטוס",
    delete: "מחיקת אירוע",
    confirmDelete: "למחוק את האירוע? פעולה זו אינה ניתנת לביטול.",
    deleting: "מוחק...",
    // guest link
    guestLinkTitle: "קישור לאורחים",
    guestLinkHelp: "שתפו את הקישור או ה-QR עם אורחי האירוע",
    copyLink: "העתקת קישור",
    copied: "הועתק!",
  },
  frames: {
    title: "מסגרות",
    help: "העלו מסגרות PNG שקופות. כל מסגרת מזוהה אוטומטית כלרוחב או לאורך לפי מידותיה.",
    uploadButton: "העלאת מסגרת",
    uploading: "מעלה...",
    landscapeHeading: "מסגרות לרוחב",
    portraitHeading: "מסגרות לאורך",
    emptyLandscape: "אין עדיין מסגרות לרוחב",
    emptyPortrait: "אין עדיין מסגרות לאורך",
    delete: "מחיקה",
    confirmDelete: "למחוק את המסגרת?",
    // requirement banner
    needBothTitle: "כדי לפתוח את האירוע צריך לפחות מסגרת אחת לרוחב ואחת לאורך",
    cannotOpenYet: "יש להעלות מסגרת לרוחב ומסגרת לאורך לפני פתיחת האירוע",
    // error messages (mapped from server error codes)
    errInvalidType: "יש להעלות קובץ PNG בלבד",
    errTooLarge: "הקובץ גדול מדי (עד 4 מגה-בייט)",
    errAmbiguous: "המסגרת ריבועית — יש להשתמש במסגרת לרוחב או לאורך",
    errNeedsBoth: "לא ניתן לפתוח: חסרה מסגרת לרוחב או לאורך",
    errWouldBreak: "לא ניתן למחוק: סגרו קודם את האירוע",
    errGeneric: "ההעלאה נכשלה",
  },
} as const;
