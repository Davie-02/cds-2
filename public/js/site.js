// Page content is rendered on the server; this file only adds interactive behaviour.

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initScrollReveal();
  document.querySelectorAll("[data-slider]").forEach(initTestimonialSlider);
  document.querySelectorAll("form[data-validate]").forEach(initFormValidation);
  preselectCourse();
});

function initMobileNav() {
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  if (!toggle || !links) return;

  const setOpen = (open) => {
    links.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!links.classList.contains("is-open")));
  links
    .querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => setOpen(false)));
}

function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 },
  );
  items.forEach((item) => observer.observe(item));
}

function initTestimonialSlider(slider) {
  const slides = Array.from(slider.querySelectorAll(".testimonial"));
  const nav = slider.querySelector(".testimonial-slider__nav");
  if (slides.length < 2 || !nav) return;

  let current = 0;
  let timer = null;
  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "testimonial-slider__dot";
    dot.setAttribute("aria-label", `Show testimonial ${index + 1}`);
    dot.addEventListener("click", () => {
      show(index);
      restart();
    });
    nav.appendChild(dot);
    return dot;
  });

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => (slide.hidden = i !== current));
    dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === current)));
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => show(current + 1), 6000);
  }

  show(0);
  restart();
}

const VALIDATORS = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  tel: (value) => /^\+?[0-9 ()-]{7,20}$/.test(value),
};

// The server validates again; this only saves a round trip for obvious mistakes.
function initFormValidation(form) {
  form.addEventListener("submit", (event) => {
    let firstInvalid = null;
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      const wrapper = field.closest(".field");
      if (!wrapper) return;
      const value = field.value.trim();
      const check = VALIDATORS[field.type];
      const valid = (!field.required || value !== "") && (!value || !check || check(value));
      wrapper.classList.toggle("has-error", !valid);
      if (!valid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      event.preventDefault();
      firstInvalid.focus();
    }
  });
}

function preselectCourse() {
  const course = new URLSearchParams(window.location.search).get("course");
  const select = document.querySelector("select#course");
  if (!course || !select) return;
  const match = Array.from(select.options).find((option) => option.text === course);
  if (match) select.value = match.value;
}
