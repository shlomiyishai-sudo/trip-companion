// נתוני הטיול: בודפשט, נובמבר 2026.
// כל טיול חדש = קובץ נתונים חדש באותו מבנה. אין כאן מידע רגיש (מספרי הזמנה, דרכונים).
window.TRIP = {
  id: "budapest-2026",
  title: "בודפשט",
  subtitle: "שלומי ואדווה",
  start: "2026-11-08",
  end: "2026-11-12",
  tz: "Europe/Budapest",
  center: { lat: 47.4995, lng: 19.0530 },
  weather: { lat: 47.4979, lng: 19.0402 },
  hotelId: "hotel",

  layers: {
    sights: { name: "אטרקציות, תצפיות וספא", color: "#2F6FDE", icon: "★" },
    food:   { name: "אוכל, קפה וברים", color: "#E0752D", icon: "🍴" },
    shop:   { name: "קניות ושווקים", color: "#9B4DCA", icon: "🛍" },
    maybe:  { name: "אולי", color: "#7C8A93", icon: "?" }
  },

  // סטטוס: must = חובה, booked = הוזמן, nice = נחמד, maybe = אולי
  // tags: romantic, indoor, view, quick, sweet, drink, rest
  places: [
    { id: "hotel", name: "Cortile Hotel", he: "המלון שלנו", layer: "hotel", q: "Cortile Hotel Dessewffy utca 14 Budapest", lat: 47.5047, lng: 19.0560,
      why: "הבית שלנו. ג'וניור סוויטה עם מרפסת, ארוחת בוקר כלולה. בריכה מקורה ועיסויים במלון (לבדוק מול המלון)." },

    // ===== אטרקציות, תצפיות וספא =====
    { id: "parliament-view", name: "Parliament view from Batthyány tér", he: "הפרלמנט מהגדה של בודה", layer: "sights", status: "must", tags: ["view","romantic"], q: "Batthyány tér Budapest", lat: 47.5068, lng: 19.0389,
      why: "הזווית הכי יפה על הפרלמנט, בלי להיכנס ובלי תורים. בשקיעה ובערב, כשהבניין מואר, זה אחד הרגעים הרומנטיים של העיר." },
    { id: "parliament", name: "Hungarian Parliament Building", he: "בניין הפרלמנט", layer: "sights", status: "nice", tags: ["view"], q: "Hungarian Parliament Building", lat: 47.5071, lng: 19.0457,
      why: "מרשים מבחוץ ומקרוב. הסיור בפנים מודרך ודורש כרטיס מראש. לפי מה שכתבתם, מספיק לעבור לידו." },
    { id: "shoes", name: "Shoes on the Danube Bank", he: "הנעליים על גדת הדנובה", layer: "sights", status: "must", tags: ["quick"], q: "Shoes on the Danube Bank", lat: 47.5045, lng: 19.0450,
      why: "אנדרטה לזכר יהודים שנרצחו על הגדה ב-1944. עצירה קצרה ומרגשת על הטיילת, בדרך לפרלמנט." },
    { id: "chain-bridge", name: "Széchenyi Chain Bridge", he: "גשר השלשלאות", layer: "sights", status: "must", tags: ["view","romantic"], q: "Széchenyi Chain Bridge", lat: 47.4990, lng: 19.0438,
      why: "חוצים ברגל, בעיקר בערב כשהגשר והמבצר מוארים. סגור לרכבים, כך שההליכה נעימה." },
    { id: "bastion", name: "Fisherman's Bastion", he: "מבצר הדייגים", layer: "sights", status: "must", tags: ["view","romantic"], q: "Fisherman's Bastion", lat: 47.5022, lng: 19.0348,
      why: "התצפית המפורסמת על הפרלמנט והדנובה. הקומה התחתונה חינם. כדאי להגיע לפני 11:00, לפני שהקבוצות מגיעות." },
    { id: "matthias", name: "Matthias Church", he: "כנסיית מתיאש", layer: "sights", status: "nice", tags: ["quick"], q: "Matthias Church Budapest", lat: 47.5019, lng: 19.0342,
      why: "גג הרעפים הצבעוני צמוד למבצר הדייגים. מתרשמים מבחוץ וממשיכים." },
    { id: "castle", name: "Buda Castle", he: "ארמון בודה", layer: "sights", status: "must", tags: ["view"], q: "Buda Castle", lat: 47.4961, lng: 19.0396,
      why: "שיטוט בחצרות ובטרסות, עם נוף לפשט. את המוזיאונים בפנים אפשר לדלג. עולים באוטובוס 16 במקום ברכבל, כדי לחסוך את התור." },
    { id: "liberty", name: "Liberty Statue, Gellért Hill", he: "גבעת גלרט ופסל החירות", layer: "sights", status: "must", tags: ["view"], q: "Liberty Statue Budapest", lat: 47.4867, lng: 19.0472,
      why: "התצפית הכי רחבה על העיר. עלייה של כ-20–30 דקות, מתאימה לשלומי. לאדווה יש אפשרות לעלות במונית ולהיפגש למעלה." },
    { id: "basilica", name: "St. Stephen's Basilica", he: "בזיליקת סנט סטפן", layer: "sights", status: "nice", tags: ["view","quick"], q: "St. Stephen's Basilica", lat: 47.5009, lng: 19.0539,
      why: "חמש דקות הליכה מהמלון. החזית והכיכר מרשימות. מרפסת הכיפה (יש מעלית) היא תצפית 360° קצרה, ולרוב בלי תור ארוך." },
    { id: "opera", name: "Hungarian State Opera", he: "בית האופרה", layer: "sights", status: "nice", tags: ["quick"], q: "Hungarian State Opera House", lat: 47.5027, lng: 19.0584,
      why: "על שדרות אנדראשי, ממש ליד המלון. מצטלמים בחזית וממשיכים." },
    { id: "dohany", name: "Dohány Street Synagogue", he: "בית הכנסת ברחוב דוהאני", layer: "sights", status: "must", tags: ["quick"], q: "Dohány Street Synagogue", lat: 47.4960, lng: 19.0607,
      why: "בית הכנסת הגדול באירופה. ביקור קצר מבחוץ ובחצר, בתוך שיטוט ברובע היהודי." },
    { id: "heroes", name: "Heroes' Square", he: "כיכר הגיבורים", layer: "sights", status: "nice", tags: ["quick"], q: "Heroes' Square Budapest", lat: 47.5149, lng: 19.0778,
      why: "עוברים בשיטוט בדרך למרחצאות סצ'ני. גלידה או קפה, ובלי לאכול כאן ארוחה." },
    { id: "vajdahunyad", name: "Vajdahunyad Castle", he: "טירת וידהוניאד", layer: "sights", status: "nice", tags: ["romantic","quick"], q: "Vajdahunyad Castle", lat: 47.5150, lng: 19.0820,
      why: "טירה מהאגדות על אגם בפארק העיר, 5 דקות מסצ'ני. יפה במיוחד בשעת בין ערביים." },
    { id: "margaret", name: "Margaret Island", he: "אי מרגיט", layer: "sights", status: "nice", tags: ["rest"], q: "Margaret Island Budapest", lat: 47.5270, lng: 19.0470,
      why: "טיול רגוע בפארק באמצע הנהר, בלי תנועה. טוב לשעה פנויה או ליום האחרון." },
    { id: "szechenyi", name: "Széchenyi Thermal Bath", he: "מרחצאות סצ'ני", layer: "sights", status: "must", tags: ["indoor","romantic","rest"], q: "Széchenyi Thermal Bath", lat: 47.5187, lng: 19.0817,
      why: "המרחצאות האייקוניים: בריכות חיצוניות חמות באוויר הקר של נובמבר. כדאי לקנות כרטיס עם תא הלבשה פרטי מראש, ולהגיע אחר הצהריים ביום חול." },
    { id: "rudas", name: "Rudas Thermal Bath", he: "מרחצאות רודאש", layer: "sights", status: "nice", tags: ["indoor","view"], q: "Rudas Thermal Bath", lat: 47.4890, lng: 19.0450,
      why: "בריכה עות'מאנית מהמאה ה-16 וג'קוזי על הגג עם נוף לדנובה. חלופה או תוספת לסצ'ני, ופחות צפוף ממנו בימי חול." },
    { id: "szentendre", name: "Szentendre", he: "סנטנדרה", layer: "sights", status: "must", tags: ["romantic"], q: "Szentendre Fő tér", lat: 47.6694, lng: 19.0756,
      why: "עיירת אמנים ציורית על הדנובה: סמטאות, גלריות, בתי קפה ומרציפן. 40 דקות ברכבת HÉV H5 מבטיאני טר." },
    { id: "visegrad", name: "Visegrád Citadel", he: "מצודת ויסגרד", layer: "sights", status: "must", tags: ["view"], q: "Visegrád Upper Castle", lat: 47.7930, lng: 18.9810,
      why: "תצפית על עיקול הדנובה מגבעה מיוערת: טבע ואווירה כפרית. מסנטנדרה באוטובוס 880, או עם נהג פרטי ליום נוח יותר." },
    { id: "hotel-spa", name: "Cortile Hotel spa", he: "הספא במלון", layer: "sights", status: "maybe", tags: ["indoor","rest","romantic"], q: "Cortile Hotel Dessewffy utca 14 Budapest", lat: 47.5047, lng: 19.0560,
      why: "עיסוי זוגי ובריכה ביום האחרון, אחרי הצ'ק-אאוט. לבדוק מול המלון אילו טיפולים יש ואם אפשר להשתמש בספא אחרי 11:00." },

    // ===== אוכל, קפה וברים =====
    { id: "market-hall", name: "Great Market Hall", he: "השוק הגדול", layer: "food", status: "must", tags: ["indoor"], q: "Great Market Hall Budapest", lat: 47.4870, lng: 19.0583,
      why: "השוק המקורה ההיסטורי. בקומה הראשונה פפריקה, יין ומעדנים; למעלה לאנגוש ודוכני אוכל. סגור בימי ראשון." },
    { id: "karavan", name: "Karaván street food", he: "קרוואן, אוכל רחוב", layer: "food", status: "nice", tags: ["quick"], q: "Karaván Street Food Budapest", lat: 47.4977, lng: 19.0627,
      why: "חצר של משאיות אוכל ברובע היהודי. מגוון, מהיר וזול: טוב לנשנוש בין הליכות." },
    { id: "mazeltov", name: "Mazel Tov", he: "מזל טוב", layer: "food", status: "nice", tags: ["romantic","indoor"], q: "Mazel Tov Budapest Akácfa", lat: 47.5005, lng: 19.0640,
      why: "מסעדה ים-תיכונית וישראלית בחצר מקורה מלאה צמחייה ואורות. אווירה יפה לערב, ותפריט שקל להתאים למגבלות." },
    { id: "borkonyha", name: "Borkonyha Winekitchen", he: "בורקוניה, מטבח ויין", layer: "food", status: "maybe", tags: ["romantic","indoor","drink"], q: "Borkonyha Winekitchen Budapest", lat: 47.4995, lng: 19.0510,
      why: "מועמדת לארוחה המיוחדת: מטבח הונגרי מודרני עם כוכב מישלן ורשימת יינות הונגריים ענקית. להזמין מראש, ולבקש מראש התאמה למגבלות." },
    { id: "gerbeaud", name: "Gerbeaud", he: "ז'רבו", layer: "food", status: "nice", tags: ["sweet","indoor"], q: "Gerbeaud Café Budapest", lat: 47.4970, lng: 19.0500,
      why: "בית קפה היסטורי מ-1858 בכיכר ורשמרטי. עוגת דובוש ושטרודל." },
    { id: "central-cafe", name: "Centrál Kávéház", he: "קפה סנטרל", layer: "food", status: "nice", tags: ["sweet","indoor","rest"], q: "Centrál Kávéház Budapest", lat: 47.4920, lng: 19.0560,
      why: "בית קפה ספרותי משנת 1887. אותה אווירה של פעם, בלי התורים של ניו יורק קפה." },
    { id: "newyork", name: "New York Café", he: "ניו יורק קפה", layer: "maybe", status: "maybe", tags: ["sweet","indoor","romantic"], q: "New York Café Budapest", lat: 47.4985, lng: 19.0710,
      why: "\"בית הקפה היפה בעולם\". מאוד תיירותי, ויש תור בלי הזמנה. אם רוצים, מזמינים מקום מראש לשעה קבועה." },
    { id: "highnote", name: "High Note SkyBar", he: "הבר על הגג High Note", layer: "food", status: "must", tags: ["romantic","drink","view"], q: "High Note SkyBar Budapest", lat: 47.5010, lng: 19.0525,
      why: "בר קוקטיילים על הגג, מול הכיפה של הבזיליקה, 5 דקות מהמלון. מושלם לשקיעה או לסוף הערב." },
    { id: "bar360", name: "360 Bar", he: "בר 360", layer: "food", status: "nice", tags: ["romantic","drink","view"], q: "360 Bar Budapest Andrássy", lat: 47.5040, lng: 19.0620,
      why: "גג עם נוף 360° על אנדראשי. בחורף יש בועות שקופות מחוממות לזוגות (מומלץ להזמין)." },
    { id: "divino", name: "DiVino Bazilika", he: "דיוינו, בר יין", layer: "food", status: "nice", tags: ["drink","quick"], q: "DiVino Borbár Budapest Bazilika", lat: 47.5005, lng: 19.0535,
      why: "בר יין הונגרי ליד הבזיליקה. טעימות יין בכוסות קטנות. מתאים לפני ארוחת ערב." },
    { id: "doblo", name: "Doblo Wine Bar", he: "דובלו, בר יין ומוזיקה", layer: "food", status: "nice", tags: ["drink","romantic","indoor"], q: "Doblo Wine Bar Budapest", lat: 47.4975, lng: 19.0605,
      why: "בר יין עם קירות לבנים ונרות ברובע היהודי. יש מוזיקה חיה בשקט יחסי: טוב לאדווה וגם לשלומי." },
    { id: "szimpla", name: "Szimpla Kert", he: "שימפלה, בר חורבות", layer: "maybe", status: "maybe", tags: ["drink"], q: "Szimpla Kert Budapest", lat: 47.4970, lng: 19.0633,
      why: "בר החורבות המפורסם. בערב צפוף ורועש, אבל ביום ראשון בבוקר יש בו שוק איכרים (לבדוק שעות): אולי ביום ההגעה." },

    // ===== קניות ושווקים =====
    { id: "vaci", name: "Váci utca", he: "רחוב ואצי", layer: "shop", status: "nice", tags: ["quick"], q: "Váci utca Budapest", lat: 47.4930, lng: 19.0530,
      why: "רחוב הקניות להולכי רגל, בין כיכר ורשמרטי לשוק הגדול. רשתות ומזכרות. האוכל כאן תיירותי ויקר." },
    { id: "andrassy", name: "Andrássy út", he: "שדרות אנדראשי", layer: "shop", status: "nice", tags: [], q: "Andrássy út Budapest", lat: 47.5060, lng: 19.0640,
      why: "השדרה האלגנטית עם חנויות המותגים. מתחילה ממש ליד המלון." },
    { id: "westend", name: "WestEnd City Center", he: "קניון ווסטאנד", layer: "shop", status: "nice", tags: ["indoor"], q: "WestEnd City Center Budapest", lat: 47.5125, lng: 19.0590,
      why: "קניון גדול, 15 דקות הליכה מהמלון, ליד תחנת ניוגטי. טוב ליום גשום או לבוקר האחרון." },
    { id: "primark", name: "Primark", he: "פריימארק", layer: "shop", status: "maybe", tags: ["indoor"], q: "Primark Budapest", lat: 47.4900, lng: 19.0700,
      why: "בשביל אדווה. הכתובת והשעות מתעדכנות מגוגל כשפותחים את הכרטיס." },
    { id: "retrock", name: "Retrock", he: "רטרוק, וינטג'", layer: "shop", status: "nice", tags: ["indoor"], q: "Retrock Budapest", lat: 47.4975, lng: 19.0560,
      why: "וינטג' ויד שנייה עם מעצבים מקומיים, במרכז. בשביל אדווה." },
    { id: "szputnyik", name: "Szputnyik Shop", he: "ספוטניק, יד שנייה", layer: "shop", status: "nice", tags: ["indoor"], q: "Szputnyik Shop Budapest", lat: 47.4985, lng: 19.0610,
      why: "חנות וינטג' ויד שנייה ברובע היהודי, קרובה לקרוואן ולדובלו." }
  ],

  // התוכנית היומית. anchor = התחייבות לשעה מסוימת. book = צריך להזמין.
  days: [
    { date: "2026-11-08", title: "הגעה ושיטוט ראשון", summary: "יום רך: נוחתים, מתמקמים, ובערב פוגשים את הדנובה המוארת.",
      items: [
        { time: "11:15", text: "נחיתה ב-BUD (אל על LY2369)", kind: "flight" },
        { time: "12:15", text: "מונית או הסעה למלון, בערך 30–40 דקות. משאירים מזוודות (הצ'ק-אין מ-14:00)", place: "hotel", kind: "move", book: "transfer" },
        { time: "13:00", text: "ארוחת צהריים קלה ברובע היהודי", place: "karavan", alt: ["szimpla"] },
        { time: "15:00", text: "הבזיליקה מבחוץ, ואם בא: מרפסת הכיפה", place: "basilica" },
        { time: "16:00", text: "יורדים לטיילת: הנעליים על הגדה ← הפרלמנט בשקיעה (כ-16:20)", place: "shoes" },
        { time: "16:45", text: "חוצים את גשר השלשלאות כשהאורות נדלקים", place: "chain-bridge" },
        { time: "17:15", text: "הפרלמנט המואר מהגדה של בודה", place: "parliament-view" },
        { time: "19:30", text: "ארוחת ערב רגועה קרוב למלון. בלי לחץ", place: "mazeltov" }
      ]},
    { date: "2026-11-09", title: "טעימות, שוק ומרחצאות", summary: "יום של אוכל: סיור קולינרי, קניות קלות, ואחר הצהריים מרחצאות חמים.",
      items: [
        { time: "10:00", text: "סיור קולינרי מותאם (העוגן של היום)", place: "market-hall", anchor: true, book: "food-tour" },
        { time: "13:30", text: "שיטוט וקניות ברחוב ואצי", place: "vaci" },
        { time: "15:00", text: "מטרו M1 ההיסטורי (הקו הצהוב) לפארק העיר", kind: "move" },
        { time: "15:30", text: "מרחצאות סצ'ני, 2–3 שעות", place: "szechenyi", book: "szechenyi" },
        { time: "18:15", text: "טירת וידהוניאד בחושך ← כיכר הגיבורים", place: "vajdahunyad" },
        { time: "19:30", text: "קוקטייל על הגג מול הבזיליקה", place: "highnote" },
        { time: "20:30", text: "ארוחת ערב כיפית (לבחור בזמן אמת)", kind: "free" }
      ]},
    { date: "2026-11-10", title: "עיקול הדנובה", summary: "יום כפרי: סמטאות סנטנדרה, ואחר כך תצפית מיוערת על עיקול הנהר. אם יורד גשם, מחליפים עם יום 4.",
      items: [
        { time: "10:00", text: "רכבת HÉV H5 מבטיאני טר לסנטנדרה, כ-40 דקות", kind: "move", place: "parliament-view" },
        { time: "10:45", text: "שיטוט בסנטנדרה, קפה ומאפה", place: "szentendre" },
        { time: "12:30", text: "ארוחת צהריים בסנטנדרה", place: "szentendre" },
        { time: "14:00", text: "אוטובוס 880 לויסגרד, או נהג פרטי", kind: "move", book: "driver" },
        { time: "14:45", text: "מצודת ויסגרד ותצפית על עיקול הדנובה", place: "visegrad" },
        { time: "16:30", text: "חזרה לבודפשט, כשעה וחצי", kind: "move" },
        { time: "19:30", text: "בר יין ליד המלון, ואחריו ארוחת ערב רגועה", place: "divino" }
      ]},
    { date: "2026-11-11", title: "בודה מלמעלה ורובע יהודי", summary: "התצפיות הגדולות בבוקר, ובערב הארוחה המיוחדת.",
      items: [
        { time: "10:00", text: "אוטובוס 16 מכיכר דאק לגבעת המבצר (במקום התור לרכבל)", kind: "move" },
        { time: "10:20", text: "מבצר הדייגים לפני הקבוצות", place: "bastion" },
        { time: "10:50", text: "כנסיית מתיאש מבחוץ ← שיטוט בחצרות הארמון", place: "castle" },
        { time: "13:00", text: "ארוחת צהריים בצד בודה, או נשנוש", kind: "free" },
        { time: "14:30", text: "תצפית מגבעת גלרט (שלומי ברגל, אדווה במונית אם רוצה)", place: "liberty" },
        { time: "16:30", text: "רודאש: ג'קוזי על הגג בשקיעה (אופציונלי)", place: "rudas" },
        { time: "18:00", text: "רובע יהודי: בית הכנסת מבחוץ, יד שנייה, יין", place: "dohany", alt: ["szputnyik","doblo"] },
        { time: "20:00", text: "הארוחה המיוחדת", place: "borkonyha", anchor: true, book: "special-dinner" }
      ]},
    { date: "2026-11-12", title: "פינוק ויציאה", summary: "בוקר איטי, ספא, ועוד שיטוט אחרון לפני הטיסה.",
      items: [
        { time: "09:30", text: "ארוחת בוקר בלי למהר" , place: "hotel" },
        { time: "11:00", text: "צ'ק-אאוט. המזוודות נשארות בשמירה במלון", place: "hotel", kind: "move" },
        { time: "11:30", text: "ספא במלון: עיסוי ובריכה (העוגן של היום)", place: "hotel-spa", anchor: true, book: "hotel-spa" },
        { time: "14:00", text: "קניות אחרונות או אי מרגיט, לפי החשק", place: "westend", alt: ["margaret","primark"] },
        { time: "16:30", text: "קפה ועוגה אחרונים", place: "gerbeaud", alt: ["central-cafe"] },
        { time: "17:45", text: "לוקחים מזוודות ← שדה התעופה", place: "hotel", kind: "move", book: "transfer" },
        { time: "20:40", text: "המראה (אל על LY2368). נחיתה 00:50", kind: "flight" }
      ]}
  ],

  bookings: [
    { id: "food-tour", title: "סיור קולינרי פרטי או קבוצה קטנה", when: "9.11 בבוקר", urgency: "high",
      note: "לבקש בכתב, מראש: בלי חזיר ושומן חזיר (zsír), בלי פירות ים, בלי בשר וחלב יחד, ובלי פול לאדווה." },
    { id: "hotel-spa", title: "טיפול בספא המלון ושימוש אחרי הצ'ק-אאוט", when: "12.11, 11:30", urgency: "high",
      note: "לשאול את המלון: אילו טיפולים יש, האם יש עיסוי זוגי, ואם אפשר להשתמש בבריכה ובספא אחרי 11:00. לבקש גם שמירת מזוודות." },
    { id: "special-dinner", title: "הארוחה המיוחדת", when: "11.11, 20:00", urgency: "high",
      note: "תקציב 150–250€ לזוג. לציין את המגבלות בהזמנה." },
    { id: "transfer", title: "הסעה מהשדה ובחזרה", when: "8.11 11:15 / 12.11 17:45", urgency: "mid",
      note: "Bolt או מונית רשמית (Főtaxi) מהדלפק בשדה, או הסעה פרטית מוזמנת. ההמלצה תגיע בקרוב." },
    { id: "szechenyi", title: "כרטיסי סצ'ני עם תא פרטי", when: "9.11 אחה\"צ", urgency: "low",
      note: "קונים באתר הרשמי של המרחצאות. תא פרטי נוח יותר מלוקר." },
    { id: "driver", title: "נהג פרטי לעיקול הדנובה (אופציונלי)", when: "10.11", urgency: "low",
      note: "חוסך את האוטובוס. אפשר להחליט אחרי שרואים את מזג האוויר." }
  ],

  docs: [
    { kind: "flight", title: "טיסת הלוך: אל על LY2369", lines: ["8.11.2026 · נתב\"ג 08:40 ← בודפשט 11:15", "משך: 3:35"] },
    { kind: "flight", title: "טיסת חזור: אל על LY2368", lines: ["12.11.2026 · בודפשט 20:40 ← נתב\"ג 00:50 (13.11)", "להגיע לשדה עד 18:40"] },
    { kind: "hotel", title: "Cortile Hotel, Adults Only", lines: ["Dessewffy utca 14, 1066 Budapest", "Junior Suite עם מרפסת · ארוחת בוקר כלולה · 4 לילות", "צ'ק-אין 8.11 מ-14:00 · צ'ק-אאוט 12.11 עד 11:00"], place: "hotel" }
  ],

  emergency: [
    { label: "מספר חירום (משטרה, אמבולנס, כיבוי)", value: "112" },
    { label: "שגרירות ישראל בבודפשט", value: "לחיפוש בגוגל מפס", q: "Embassy of Israel Budapest" },
    { label: "כתובת המלון להראות לנהג", value: "Dessewffy utca 14, 1066 Budapest" }
  ],

  tips: [
    { t: "שומן חזיר", d: "הרבה מנות הונגריות מבושלות בשומן חזיר (zsír). כדאי לשאול: \"Sertészsír van benne?\" (יש בזה שומן חזיר?)" },
    { t: "בלי חזיר", d: "\"Nem eszem sertéshúst\" פירושו \"אני לא אוכל חזיר\". שומרים את המשפט בטלפון." },
    { t: "פול", d: "בהונגרית פול הוא lóbab. בשביל אדווה." },
    { t: "טיפ במסעדה", d: "לבדוק אם בחשבון כבר מופיע szervizdíj (דמי שירות). אם לא, מקובל להוסיף 10–15%." },
    { t: "שוקי חג המולד", d: "שווקי ורשמרטי והבזיליקה נפתחים ב-13.11, יום אחרי שאתם טסים. ייתכן שתראו את ההכנות." },
    { t: "גלרט סגור", d: "מרחצאות גלרט סגורים לשיפוץ עד 2028. לכן במסלול יש את סצ'ני ורודאש." },
    { t: "שקיעה מוקדמת", d: "בנובמבר השמש שוקעת בסביבות 16:20. התצפיות הכי יפות בין 15:30 ל-17:00, ובערב העיר מוארת." }
  ]
};
