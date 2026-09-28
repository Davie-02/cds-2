import type { Settings } from "../../shared/settings.js";

/**
 * Default content for a fresh database. Settings are merged under whatever the admin saves,
 * so new settings always have a value. Collections are inserted once, on first start, and
 * from then on belong to the admin (deleting every course does not bring the defaults back).
 */

export const DEFAULT_SETTINGS: Settings = {
  general: {
    school_name: "Chimwemwe Driving School2",
    tagline: "Home of Competent Drivers",
    logo: "/images/logo.png",
    favicon: "/images/favicon.png",
    primary_color: "#f5c344",
    dark_color: "#1c2024",
    accent_color: "#c94f3d",
    footer_text: "Teaching safe, confident drivers across Mzuzu and Karonga since 1992.",
    footer_column_1: "Explore",
    footer_column_2: "Support",
    copyright: "Chimwemwe Driving School2",
    default_seo_description:
      "Chimwemwe Driving School2 offers motorcycle, car and heavy vehicle licence courses in Mzuzu and Karonga, Malawi.",
  },
  contact: {
    phone: "+265 999 118 292",
    email: "chimwemwedrivingschool0@gmail.com",
    address: "Old town roundabout, Karonga, Malawi",
    whatsapp_number: "+265 999 118 292",
    whatsapp_message: "Hello, I would like more information.",
    opening_hours: [{ days: "Mon–Sat", hours: "7:00–17:00" }],
    map_latitude: "-9.9404",
    map_longitude: "33.9296",
    map_zoom: 14,
    social_links: [],
  },
  booking: {
    timezone: "Africa/Blantyre",
    self_booking_enabled: true,
    require_confirmation: true,
    lesson_minutes: 30,
    max_lessons_per_day: 2,
    min_notice_hours: 12,
    booking_horizon_days: 30,
    cancellation_hours: 24,
    opening_time: "07:00",
    closing_time: "17:00",
    working_days: ["1", "2", "3", "4", "5", "6"],
  },
  theory: {
    pass_mark_percent: 80,
    readiness_skill_percent: 100,
    readiness_mock_passes: 2,
  },
  payments: {
    currency: "MK",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    mobile_money: "",
    invoice_note: "Thank you for choosing Chimwemwe Driving School2.",
    payment_due_days: 14,
  },
  reminders: {
    vehicle_warning_days: 30,
    reminder_email: "",
  },
};

export interface DefaultSection {
  type: string;
  content: Record<string, unknown>;
  visible?: boolean;
}

export interface DefaultPage {
  slug: string;
  title: string;
  seo_title?: string;
  seo_description?: string;
  published?: boolean;
  is_system?: boolean;
  sections: DefaultSection[];
}

const bookButton = { button_label: "Book Your First Lesson", button_link: "/contact" };

export const DEFAULT_PAGES: DefaultPage[] = [
  {
    slug: "home",
    title: "Home",
    seo_title: "Chimwemwe Driving School2 — Learn to Drive with Confidence",
    seo_description:
      "Chimwemwe Driving School2 offers motorcycle, car and heavy vehicle courses with certified instructors in Mzuzu and Karonga. Book your first lesson today.",
    is_system: true,
    sections: [
      {
        type: "hero",
        content: {
          badge: "Enrolling now — Mzuzu & Karonga",
          heading: "Your road to a licence starts with Chimwemwe.",
          text: "Patient, certified instructors. Modern dual-control cars. A structured course that takes you from your first turn of the key to passing your test — with confidence, not stress.",
          primary_label: "Book Your First Lesson",
          primary_link: "/contact",
          secondary_label: "View Courses",
          secondary_link: "/courses",
          stats: [
            { value: "5+", label: "Years teaching" },
            { value: "600+", label: "Licensed graduates" },
            { value: "94%", label: "First-time pass rate" },
          ],
          show_route: true,
        },
      },
      {
        type: "cards",
        content: {
          eyebrow: "Why Chimwemwe",
          heading: "Built around how people actually learn to drive.",
          intro:
            "We keep class sizes small, lessons practical, and instructors patient — so nerves turn into confidence, not the other way around.",
          columns: "4",
          cards: [
            {
              icon: "star",
              title: "Certified instructors",
              text: "Every instructor is government-certified and trained specifically in defensive, learner-first teaching methods.",
            },
            {
              icon: "car",
              title: "Dual-control vehicles",
              text: "Learn in well-maintained cars fitted with dual controls, so your instructor can step in if needed.",
            },
            {
              icon: "clock",
              title: "Flexible scheduling",
              text: "Morning, evening and weekend slots — book lessons around work, school or family commitments.",
            },
            {
              icon: "check",
              title: "Real pass-rate results",
              text: "A structured curriculum aligned with the official road traffic test, so nothing you learn is wasted.",
            },
          ],
        },
      },
      {
        type: "courses",
        content: {
          eyebrow: "Courses",
          heading: "Pick the course that matches where you're starting from.",
          intro:
            "From absolute beginners to drivers who just need a refresher, there's a structured path for you.",
          category: "course",
          dark: true,
        },
      },
      {
        type: "steps",
        content: {
          eyebrow: "The process",
          heading: "Four steps from enquiry to licence.",
          steps: [
            {
              title: "Book a slot",
              text: "Fill in the contact form or call us to reserve your place on a course.",
            },
            {
              title: "Theory class",
              text: "Learn road signs, right-of-way rules and the highway code in small groups.",
            },
            {
              title: "Practical lessons",
              text: "One-on-one time behind the wheel with your dedicated instructor.",
            },
            {
              title: "Test day",
              text: "Sit a mock test with us first, then take your official test with confidence.",
            },
          ],
        },
      },
      {
        type: "news",
        content: { eyebrow: "Latest News", heading: "What's happening at Chimwemwe", limit: 3 },
      },
      {
        type: "testimonials",
        content: { eyebrow: "Testimonials", heading: "What our graduates say", style: "slider" },
      },
      {
        type: "cta",
        content: {
          heading: "Ready to get on the road?",
          text: "Spaces for our next intake are limited.",
          ...bookButton,
        },
      },
    ],
  },
  {
    slug: "about",
    title: "About",
    seo_title: "About Us — Chimwemwe Driving School2",
    seo_description: "Learn about Chimwemwe Driving School2's mission, history and values.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "About Us",
          heading: "Teaching Malawi to drive safely since 1992.",
          text: 'Chimwemwe — meaning "joy" in Chichewa — was founded on a simple idea: learning to drive should feel encouraging, not intimidating.',
        },
      },
      {
        type: "text_image",
        content: {
          eyebrow: "Our story",
          heading: "From one instructor to a full school.",
          body: "Chimwemwe Driving School2 began in 1992 with a single instructor, a single car, and a waiting list that kept growing by word of mouth. Parents wanted an instructor patient enough for nervous first-timers; professionals wanted a course that fit around a working week.\n\nToday we run two branches, a small fleet of dual-control vehicles, and a curriculum built around Malawi's official road traffic test — but the same philosophy from day one still holds: every learner moves at their own pace, and every instructor is trained to teach with patience first.",
          image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
          image_alt: "Instructor and student reviewing a driving lesson beside a car",
          image_side: "right",
        },
      },
      {
        type: "cards",
        content: {
          eyebrow: "What we stand for",
          heading: "Our values on and off the road.",
          columns: "3",
          dark: true,
          cards: [
            {
              icon: "shield",
              title: "Safety first",
              text: "Every lesson plan is built around defensive driving, not just passing a test.",
            },
            {
              icon: "user",
              title: "Patience always",
              text: "Nervous learners and confident ones alike get the same respect and pace.",
            },
            {
              icon: "check",
              title: "Honest progress",
              text: "We tell you exactly where you stand — no false confidence before test day.",
            },
          ],
        },
      },
      {
        type: "rich_text",
        content: {
          heading: "Meet the team behind every lesson.",
          body: "Every instructor is licensed, background-checked, and trained in our teaching method.",
          centered: true,
          button_label: "Meet Our Instructors",
          button_link: "/instructors",
        },
      },
    ],
  },
  {
    slug: "courses",
    title: "Courses",
    seo_title: "Courses & Pricing — Chimwemwe Driving School2",
    seo_description:
      "Compare Chimwemwe Driving School2's motorcycle, car and heavy vehicle licence courses and prices.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Courses",
          heading: "Courses built around your starting point.",
          text: "Every course includes theory classes, practical lessons and progress check-ins. Pick the one that matches your experience level below.",
        },
      },
      { type: "courses", content: { category: "course" } },
      {
        type: "courses",
        content: {
          eyebrow: "Add-ons",
          heading: "Extra training, priced by the session.",
          category: "addon",
          dark: true,
        },
      },
      { type: "faq", content: { eyebrow: "FAQs", heading: "Common questions about our courses" } },
      {
        type: "cta",
        content: {
          heading: "Not sure which course fits you?",
          text: "Tell us your experience level and we'll recommend one.",
          button_label: "Ask Us",
          button_link: "/contact",
        },
      },
    ],
  },
  {
    slug: "instructors",
    title: "Instructors",
    seo_title: "Our Instructors — Chimwemwe Driving School2",
    seo_description: "Meet the certified, patient instructors at Chimwemwe Driving School2.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Instructors",
          heading: "Certified instructors, chosen for patience.",
          text: "Every instructor at Chimwemwe passes a road-skills assessment and a teaching-style interview before joining our team.",
        },
      },
      { type: "instructors", content: {} },
      {
        type: "cta",
        content: {
          heading: "Want to be paired with a specific instructor?",
          text: "Let us know your preference when you book.",
          ...bookButton,
        },
      },
    ],
  },
  {
    slug: "gallery",
    title: "Gallery",
    seo_title: "Gallery — Chimwemwe Driving School2",
    seo_description:
      "Photos from lessons, the training yard and graduation days at Chimwemwe Driving School2.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Gallery",
          heading: "A look inside our lessons.",
          text: "From first lessons in the practice yard to graduation day — moments from the Chimwemwe community.",
        },
      },
      { type: "gallery", content: {} },
      {
        type: "cta",
        content: {
          heading: "Want to see the fleet in person?",
          text: "Visit our Mzuzu or Karonga branch, no appointment needed.",
          button_label: "Get Directions",
          button_link: "/contact",
        },
      },
    ],
  },
  {
    slug: "testimonials",
    title: "Testimonials",
    seo_title: "Testimonials — Chimwemwe Driving School2",
    seo_description: "What graduates say about learning to drive with Chimwemwe Driving School2.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Testimonials",
          heading: "Hundreds of graduates. Here's what a few of them say.",
        },
      },
      { type: "testimonials", content: { style: "grid" } },
      {
        type: "cta",
        content: {
          heading: "Ready to write your own success story?",
          text: "Join our next intake this month.",
          ...bookButton,
        },
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    seo_title: "Contact & Booking — Chimwemwe Driving School2",
    seo_description:
      "Book your first driving lesson or get in touch with Chimwemwe Driving School2.",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Contact",
          heading: "Let's get you booked in.",
          text: "Fill in the form below, call us, or visit either branch. We usually reply within one business day.",
        },
      },
      {
        type: "contact",
        content: {
          form_heading: "Book a lesson",
          form_note:
            "We'll reply by email or phone within one business day to confirm your first lesson.",
          submit_label: "Send Booking Request",
          branches_heading: "Visit or call us",
          show_map: true,
        },
      },
    ],
  },
  {
    slug: "news",
    title: "News",
    seo_title: "News — Chimwemwe Driving School2",
    is_system: true,
    sections: [
      {
        type: "page_header",
        content: { eyebrow: "News", heading: "News and updates from the school." },
      },
      { type: "news", content: { limit: 24 } },
    ],
  },
  {
    slug: "downloads",
    title: "Downloads",
    seo_title: "Downloads — Chimwemwe Driving School2",
    published: false,
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Downloads",
          heading: "Forms and guides.",
          text: "Application forms, price lists and study material.",
        },
      },
      { type: "downloads", content: {} },
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    seo_description: "How Chimwemwe Driving School2 collects and uses your information.",
    sections: [
      { type: "page_header", content: { heading: "Privacy Policy" } },
      {
        type: "rich_text",
        content: {
          body: "## Information we collect\n\nWhen you book a lesson or register as a student, we collect your **name, email, phone number, course preference** and the documents needed for your licence application, so we can schedule lessons and prepare you for your tests.\n\n## How we use it\n\nWe use your details only to:\n\n- Contact you about bookings and lesson scheduling\n- Send reminders about upcoming lessons or test dates\n- Keep records of payments and progress\n- Improve our courses based on feedback\n\nWe do not sell or share your information with third parties for marketing purposes.\n\n## Contact us\n\nIf you have questions about your data, email us at chimwemwedrivingschool0@gmail.com.",
        },
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms and Policies",
    seo_description: "Booking, cancellation and payment terms at Chimwemwe Driving School2.",
    sections: [
      { type: "page_header", content: { heading: "Terms and Policies" } },
      {
        type: "rich_text",
        content: {
          body: "## Bookings\n\nLessons are confirmed once the office or your instructor accepts them. Please arrive five minutes early with your learner's permit.\n\n## Cancellations\n\nYou can cancel or move a lesson free of charge up to 24 hours before it starts. Later cancellations and missed lessons count as taken.\n\n## Payments\n\nCourse fees can be paid in full or in the agreed instalments. Practical lessons may be paused while a balance is overdue.\n\n## Tests\n\nWe book official tests once your instructor confirms you are ready. Test fees charged by the Road Traffic Directorate are separate from course fees.",
        },
      },
    ],
  },
  {
    slug: "august-2026-offer",
    title: "August 2026 Special Offer",
    seo_description:
      "New learners receive 20% off eligible driving lessons throughout August 2026.",
    sections: [
      {
        type: "page_header",
        content: {
          eyebrow: "Special offer",
          heading: "August 2026: 20% off driving lessons",
          text: "For the entire month of August, new learners receive a 20% discount on eligible driving lessons.",
          image: "/images/uploads/grts_12.jpg",
        },
      },
      {
        type: "rich_text",
        content: {
          body: "## Offer details\n\n- **Offer:** Discounted driving lessons\n- **Discount:** 20%\n- **Valid from:** 1 August 2026\n- **Valid until:** 31 August 2026\n- **Available to:** New learners only\n\n## How to claim the offer\n\n1. Contact Chimwemwe Driving School2.\n2. Mention the **August 2026 Special Offer**.\n3. Choose your driving lesson or package.\n4. Receive the discount on your invoice.\n\n*Terms and conditions may apply.*",
          button_label: "Book now",
          button_link: "/contact",
        },
      },
    ],
  },
];

export const DEFAULT_MENU = [
  { label: "Home", url: "/", location: "header" },
  { label: "About", url: "/about", location: "header" },
  { label: "Courses", url: "/courses", location: "header" },
  { label: "Instructors", url: "/instructors", location: "header" },
  { label: "Gallery", url: "/gallery", location: "header" },
  { label: "Testimonials", url: "/testimonials", location: "header" },
  { label: "Student login", url: "/portal", location: "header" },
  { label: "Book a Lesson", url: "/contact", location: "header", is_button: true },
  { label: "About Us", url: "/about", location: "footer_1" },
  { label: "Courses & Pricing", url: "/courses", location: "footer_1" },
  { label: "Our Instructors", url: "/instructors", location: "footer_1" },
  { label: "Gallery", url: "/gallery", location: "footer_1" },
  { label: "News", url: "/news", location: "footer_1" },
  { label: "Testimonials", url: "/testimonials", location: "footer_2" },
  { label: "Contact & Booking", url: "/contact", location: "footer_2" },
  { label: "FAQs", url: "/courses#faq", location: "footer_2" },
  { label: "Terms and Policies", url: "/terms", location: "footer_2" },
  { label: "Privacy Policy", url: "/privacy-policy", location: "footer_2" },
];

export const DEFAULT_BRANCHES = [
  {
    name: "Mzuzu Branch",
    address: "Masasa, near Road Traffic, Mzuzu, Malawi",
    phone: "+265 999 118 292",
    hours: "Mon–Sat, 7:00–17:00",
  },
  {
    name: "Karonga Branch",
    address: "Old town roundabout, Karonga, Malawi",
    phone: "+265 999 118 292",
    hours: "Mon–Sat, 7:00–17:00",
  },
];

const aptitudePrep =
  "Aptitude test preparation before your official licence test with the Malawi Road Traffic Directorate";

export const DEFAULT_COURSES = [
  {
    name: "A1 Motorcycle Licence Course",
    category: "course",
    licence_class: "A1",
    gearbox: "not_applicable",
    price: 453000,
    lessons: 30,
    theory_sessions: 20,
    summary: "For learners starting from zero experience riding motorcycles.",
    included: [
      "30 practical riding lessons",
      "20 days of highway code & theory classes",
      "Aptitude test preparation before your official learner licence test with the Malawi Road Traffic Directorate",
    ],
    min_age: 16,
    documents_required: ["national_id", "passport_photo"],
  },
  {
    name: "Code B (Light Motor Vehicle) Driving Licence Course",
    category: "course",
    licence_class: "B",
    gearbox: "manual",
    price: 753000,
    lessons: 30,
    lesson_minutes: 30,
    theory_sessions: 20,
    summary: "Our most popular course.",
    included: [
      "30 practical driving lessons, 30 minutes each day",
      "20 days of highway code & theory classes",
      "2 mock road tests with our instructors",
    ],
    min_age: 18,
    documents_required: ["national_id", "passport_photo", "medical_certificate"],
    requires_permit: true,
    featured: true,
  },
  {
    name: "C1 (Heavy Goods Vehicle) Driving Licence Course",
    category: "course",
    licence_class: "C1",
    gearbox: "manual",
    price: 903000,
    lessons: 30,
    theory_sessions: 20,
    summary:
      "For licensed drivers who want to rebuild confidence and skills, and upgrade their licences to drive heavy goods vehicles.",
    included: [
      "30 practical driving lessons",
      "20 days of highway code & theory classes",
      "2 mock road tests with our instructors",
      aptitudePrep,
    ],
    min_age: 21,
    documents_required: ["national_id", "driving_licence", "medical_certificate"],
    requires_permit: true,
  },
  {
    name: "C (Heavy Goods Vehicle) Driving Licence Course — all large vehicles without trailer",
    category: "course",
    licence_class: "C",
    gearbox: "manual",
    price: 1453000,
    lessons: 15,
    theory_sessions: 10,
    summary: "For licensed drivers who want to drive all large vehicles without a trailer.",
    included: [
      "15 practical driving lessons",
      "10 days of highway code & theory classes",
      "2 mock road tests with our instructors",
      aptitudePrep,
    ],
    min_age: 21,
    documents_required: ["national_id", "driving_licence", "medical_certificate"],
    requires_permit: true,
  },
  {
    name: "CE (Articulated Trucks) Driving Licence Course — all large vehicles with trailer",
    category: "course",
    licence_class: "CE",
    gearbox: "manual",
    price: 1753000,
    lessons: 15,
    theory_sessions: 10,
    summary: "For licensed drivers who want to drive all large vehicles with a trailer.",
    included: [
      "15 practical driving lessons",
      "10 days of highway code & theory classes",
      "2 mock road tests with our instructors",
      aptitudePrep,
    ],
    min_age: 21,
    documents_required: ["national_id", "driving_licence", "medical_certificate"],
    requires_permit: true,
  },
  {
    name: "Extra practical lesson",
    category: "addon",
    gearbox: "either",
    price: 50000,
    lessons: 1,
    lesson_minutes: 30,
    summary: "A 30-minute top-up lesson with your instructor.",
    allow_instalments: false,
  },
];

export const DEFAULT_INSTRUCTORS = [
  {
    name: "Chisomo George Banda",
    role_title: "Director and Lead Instructor",
    bio: "20 years of experience in driving instruction.",
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&q=80",
  },
  {
    name: "Peter Mbewe Nyoni",
    role_title: "Instructor",
    bio: "25+ years of experience in driving instruction.",
    photo: "https://images.unsplash.com/photo-1607990283143-e81e7a2c9349?w=500&q=80",
  },
  {
    name: "Chifundo Mikundi",
    role_title: "Instructor",
    bio: "10+ years of experience in driving instruction.",
    photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&q=80",
  },
  {
    name: "Kate Chilemba",
    role_title: "Instructor",
    bio: "8 years of experience in driving instruction.",
    photo: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=500&q=80",
  },
  {
    name: "Praise Kaonga",
    role_title: "Instructor",
    bio: "6 years of experience in driving instruction.",
    photo: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=500&q=80",
  },
].map((instructor) => ({
  ...instructor,
  licence_classes: ["B"],
  languages: ["English", "Chichewa", "Tumbuka"],
  availability: ["1", "2", "3", "4", "5", "6"].map((day) => ({
    day,
    start: "07:00",
    end: "17:00",
  })),
}));

export const DEFAULT_POSTS = [
  {
    title: "September intake now open",
    slug: "september-intake-now-open",
    published_on: "2026-08-01",
    body: "Our next Beginner Course intake starts 1 September. Spaces are limited to 15 learners per group — book early to secure a morning slot.",
  },
  {
    title: "New evening slots in Karonga & Mzuzu",
    slug: "new-evening-slots",
    published_on: "2026-07-15",
    body: "By popular request, the Karonga & Mzuzu branches now offer 17:30–18:30 lessons on weekdays for learners who work during the day.",
  },
  {
    title: "Motorcycle course now includes night riding practice",
    slug: "motorcycle-night-riding",
    published_on: "2026-06-20",
    body: "We've extended the Motorcycle Course to include a supervised night-riding session, covering visibility and hazard awareness after dark.",
  },
  {
    title: "August 2026 special offer",
    slug: "august-2026-special-offer",
    published_on: "2026-08-09",
    body: "Get **20% off driving lessons** for new learners throughout August 2026.\n\n[Read more](/august-2026-offer)",
  },
];

export const DEFAULT_FAQS = [
  {
    question: "How long does a course take?",
    answer:
      "Most learners complete it in 6–10 weeks, depending on how many lessons per week you book. There's no fixed deadline — you move at your own pace.",
  },
  {
    question: "Do I need a learner's permit before starting?",
    answer:
      "No — we guide new students through applying for a learner's permit as part of the course.",
  },
  {
    question: "Can I switch instructors if it's not a good fit?",
    answer:
      "Yes, absolutely. Just let our office know and we'll pair you with another instructor at no extra cost.",
  },
  {
    question: "What happens if I fail my official test?",
    answer:
      "Course students get one free re-test preparation lesson. We'll also help you rebook your test date.",
  },
  {
    question: "Can I pay in instalments?",
    answer:
      "Yes. Most courses can be paid as a deposit followed by agreed instalments. Ask the office for a plan.",
  },
];

export const DEFAULT_TESTIMONIALS = [
  {
    name: "Mercy B.",
    quote:
      "I was terrified of driving in town traffic. My instructor was so patient — three months later I passed my test on the first try.",
  },
  {
    name: "Joseph K.",
    quote:
      "Booking lessons around my work shifts was so easy. The dual-control car made me feel safe from lesson one.",
  },
  {
    name: "Grace M.",
    quote:
      "Hadn't driven in 6 years. The refresher course got my confidence back in just two weeks.",
  },
  {
    name: "Alinafe T.",
    quote:
      "The theory classes actually explained why the rules exist, not just what they are. It stuck with me.",
  },
  {
    name: "Daniel P.",
    quote:
      "My instructor came with me to the test centre and it made all the difference to my nerves.",
  },
  {
    name: "Ruth C.",
    quote: "Learned to ride a motorcycle safely in two weeks. Worth every kwacha.",
  },
].map((testimonial) => ({ ...testimonial, stars: 5 }));

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&q=80`;

export const DEFAULT_GALLERY = [
  {
    image: unsplash("1449965408869-eaa3f722e40d"),
    caption: "Instructor guiding a student beside a car",
  },
  {
    image: unsplash("1502877338535-766e1452684a"),
    caption: "Student practising on a quiet training road",
  },
  {
    image: unsplash("1503376780353-7e6692767b70"),
    caption: "Close-up of hands on a steering wheel",
  },
  {
    image: unsplash("1503736334956-4c8f8e92946d"),
    caption: "Driving school car parked in the training yard",
  },
  {
    image: unsplash("1541899481282-d53bffe3c35d"),
    caption: "Graduate holding a completion certificate",
  },
  {
    image: unsplash("1449824913935-59a10b8d2000"),
    caption: "View of the open road from the driver's seat",
  },
  {
    image: unsplash("1517524008697-84bbe3c3fd98"),
    caption: "Two instructors reviewing a lesson plan",
  },
  {
    image: unsplash("1553440569-bcc63803a83d"),
    caption: "Student and instructor smiling after a lesson",
  },
  {
    image: unsplash("1568605117036-5fe5e7bab0b7"),
    caption: "Dashboard view during a practical lesson",
  },
];

export const DEFAULT_SKILLS = [
  ["Cockpit drill and controls", "Basics"],
  ["Moving off and stopping", "Basics"],
  ["Steering and road position", "Basics"],
  ["Gear changes", "Basics"],
  ["Mirrors and signals", "Basics"],
  ["Junctions", "Traffic"],
  ["Roundabouts", "Traffic"],
  ["Pedestrian crossings", "Traffic"],
  ["Overtaking", "Traffic"],
  ["Hill start", "Manoeuvres"],
  ["Parallel parking", "Manoeuvres"],
  ["Reverse parking", "Manoeuvres"],
  ["Three-point turn", "Manoeuvres"],
  ["Emergency stop", "Manoeuvres"],
  ["Night driving", "Conditions"],
  ["Rain and poor roads", "Conditions"],
].map(([name, category]) => ({ name, category }));

export const DEFAULT_QUESTIONS = [
  {
    prompt: "On which side of the road do vehicles drive in Malawi?",
    choices: ["Left", "Right", "Either side", "The centre"],
    correct_choice: 1,
    category: "Rules of the road",
    explanation: "Malawi drives on the left-hand side of the road.",
  },
  {
    prompt: "What does a red traffic light mean?",
    choices: [
      "Stop and wait behind the stop line",
      "Slow down",
      "Go if the road is clear",
      "Hoot and proceed",
    ],
    correct_choice: 1,
    category: "Signals",
  },
  {
    prompt: "What does an amber traffic light on its own mean?",
    choices: [
      "Stop, unless you are so close that stopping would be unsafe",
      "Speed up to get through",
      "Go",
      "Pedestrians may cross",
    ],
    correct_choice: 1,
    category: "Signals",
  },
  {
    prompt: "What shape is a STOP sign?",
    choices: ["Octagon", "Triangle", "Circle", "Square"],
    correct_choice: 1,
    category: "Road signs",
  },
  {
    prompt: "A triangular road sign with a red border is usually a…",
    choices: ["Warning", "Command", "Information sign", "Direction sign"],
    correct_choice: 1,
    category: "Road signs",
  },
  {
    prompt: "A circular sign with a red border usually…",
    choices: [
      "Tells you what you must not do",
      "Gives directions",
      "Warns of a hazard",
      "Shows services",
    ],
    correct_choice: 1,
    category: "Road signs",
  },
  {
    prompt: "When should you check your mirrors?",
    choices: [
      "Before signalling, changing speed or changing direction",
      "Only when reversing",
      "Only on the highway",
      "Once at the start of a journey",
    ],
    correct_choice: 1,
    category: "Safe driving",
  },
  {
    prompt: "At a pedestrian crossing with people waiting to cross, you should…",
    choices: [
      "Stop and let them cross",
      "Hoot to warn them",
      "Speed up",
      "Flash your lights and continue",
    ],
    correct_choice: 1,
    category: "Rules of the road",
  },
  {
    prompt: "What is the safest following distance in dry conditions?",
    choices: [
      "At least a two-second gap",
      "One car length",
      "As close as possible",
      "Half a second",
    ],
    correct_choice: 1,
    category: "Safe driving",
    explanation: "Leave at least two seconds, and double it on wet or poor roads.",
  },
  {
    prompt: "Before moving off from the side of the road you should…",
    choices: [
      "Check mirrors and blind spot, then signal if needed",
      "Hoot",
      "Switch on hazard lights",
      "Rev the engine",
    ],
    correct_choice: 1,
    category: "Safe driving",
  },
  {
    prompt: "When approaching a roundabout, you normally give way to traffic…",
    choices: ["Already on the roundabout", "Joining from your left", "Behind you", "Only lorries"],
    correct_choice: 1,
    category: "Rules of the road",
  },
  {
    prompt: "Which document must a learner carry when driving with an instructor?",
    choices: ["A valid learner's permit", "A passport", "A bank card", "No document is needed"],
    correct_choice: 1,
    category: "Licensing",
  },
];

export const DEFAULT_THEORY_TESTS = [
  { name: "Quick practice", kind: "practice", question_count: 10, show_answers: true },
  {
    name: "Mock theory exam",
    kind: "mock_exam",
    question_count: 25,
    time_limit_minutes: 30,
    show_answers: false,
  },
];

export const DEFAULT_NOTICES: Record<string, unknown>[] = [];
