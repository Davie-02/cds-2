import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { AuthGate, useAuth } from "../lib/auth";
import { BookScreen, LessonsScreen } from "./LessonScreens";
import { HomeScreen } from "./HomeScreen";
import { DocumentsScreen, PaymentsScreen } from "./PaperworkScreens";
import { TestScreen, TheoryScreen } from "./TheoryScreens";
import "../styles.css";

const TABS = [
  { to: "/", label: "Home" },
  { to: "/book", label: "Book" },
  { to: "/lessons", label: "Lessons" },
  { to: "/theory", label: "Theory" },
  { to: "/payments", label: "Payments" },
  { to: "/documents", label: "Documents" },
];

function PortalShell() {
  const { me, signOut } = useAuth();
  return (
    <div className="portal">
      <header className="topbar topbar--portal">
        <strong className="topbar__title">{me.name}</strong>
        <a className="topbar__site" href="/">
          Website
        </a>
        <button className="topbar__site" onClick={signOut}>
          Sign out
        </button>
      </header>
      <main className="content content--portal">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/book" element={<BookScreen />} />
          <Route path="/lessons" element={<LessonsScreen />} />
          <Route path="/theory" element={<TheoryScreen />} />
          <Route path="/theory/:attemptId" element={<TestScreen />} />
          <Route path="/payments" element={<PaymentsScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Portal">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === "/"}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/portal">
      <AuthGate audience="student">
        <PortalShell />
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
);
