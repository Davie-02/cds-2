export interface Overview {
  student: {
    full_name: string;
    status: string;
    instructor_id: string | null;
    course_name: string | null;
    licence_class: string | null;
    instructor_name: string | null;
  };
  readiness: { ready: boolean; checks: { label: string; done: boolean; detail: string }[] };
  balance: { balance: number; paid: number; invoiced: number } | null;
  currency: string;
  rules: {
    self_booking_enabled: boolean;
    cancellation_hours: number;
    max_lessons_per_day: number;
    booking_horizon_days: number;
    timezone: string;
  };
  contact: { phone: string | null; whatsapp_number: string | null };
}

export interface Lesson {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  kind: string;
  lesson_notes: string | null;
  instructor_id: string;
  instructor_name: string;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
}
