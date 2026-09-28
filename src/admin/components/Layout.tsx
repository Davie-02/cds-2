import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { Permission } from "../../shared/permissions";
import { RESOURCES } from "../../shared/resources";
import { useAuth } from "../lib/auth";

interface NavItem {
  to: string;
  label: string;
  permissions?: Permission[];
  ownerOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const resourceItem = (name: string): NavItem => {
  const def = RESOURCES.find((r) => r.name === name)!;
  return { to: `/r/${name}`, label: def.label, permissions: def.view };
};

const NAV: NavGroup[] = [
  {
    title: "Today",
    items: [
      { to: "/", label: "Dashboard", permissions: ["dashboard.view"] },
      {
        to: "/calendar",
        label: "Lesson calendar",
        permissions: ["bookings.view", "bookings.view_own"],
      },
    ],
  },
  {
    title: "Students",
    items: [
      { to: "/students", label: "Students", permissions: ["students.view", "students.view_own"] },
      resourceItem("enquiries"),
      resourceItem("official_tests"),
    ],
  },
  {
    title: "Theory",
    items: [
      resourceItem("questions"),
      resourceItem("theory_tests"),
      { to: "/theory/results", label: "Results", permissions: ["theory.results", "theory.manage"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/finance/balances", label: "Balances", permissions: ["finance.view"] },
      resourceItem("invoices"),
      resourceItem("payments"),
    ],
  },
  {
    title: "School",
    items: [
      resourceItem("courses"),
      resourceItem("instructors"),
      resourceItem("vehicles"),
      resourceItem("skills"),
    ],
  },
  {
    title: "Website",
    items: [
      { to: "/pages", label: "Pages", permissions: ["content.manage"] },
      resourceItem("menu_items"),
      resourceItem("posts"),
      resourceItem("notices"),
      resourceItem("faqs"),
      resourceItem("testimonials"),
      resourceItem("gallery"),
      resourceItem("downloads"),
      resourceItem("branches"),
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/settings", label: "Settings", permissions: ["settings.manage"] },
      { to: "/staff", label: "Staff & access", ownerOnly: true },
      { to: "/activity", label: "Activity log", permissions: ["activity.view"] },
      { to: "/recycle-bin", label: "Recycle bin", permissions: ["recycle.restore"] },
      { to: "/account", label: "My account" },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, can, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const visible = (item: NavItem) =>
    item.ownerOnly ? me.role === "owner" : !item.permissions || can(...item.permissions);

  return (
    <div className={`shell${open ? " shell--menu-open" : ""}`}>
      <header className="topbar">
        <button
          className="topbar__menu"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
        <strong className="topbar__title">Admin</strong>
        <a className="topbar__site" href="/" target="_blank" rel="noreferrer">
          View site
        </a>
      </header>
      <nav className="sidebar" aria-label="Admin">
        <div className="sidebar__user">
          <strong>{me.name}</strong>
          <span>{me.role}</span>
        </div>
        {NAV.map((group) => {
          const items = group.items.filter(visible);
          if (!items.length) return null;
          return (
            <div key={group.title} className="sidebar__group">
              <h2>{group.title}</h2>
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
        <button className="sidebar__signout" onClick={signOut}>
          Sign out
        </button>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
