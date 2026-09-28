import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthGate } from "./lib/auth";
import { AccountScreen } from "./screens/AccountScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ActivityScreen, RecycleBinScreen } from "./screens/HistoryScreens";
import { PageScreen } from "./screens/PageScreens";
import { BalancesScreen, TheoryResultsScreen } from "./screens/ReportScreens";
import { ResourceEditScreen, ResourceListScreen } from "./screens/ResourceScreens";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { NewStudentScreen, StudentScreen } from "./screens/StudentScreens";
import "./styles.css";

function AdminApp() {
  return (
    <AuthGate audience="staff">
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/students" element={<ResourceListScreen name="students" />} />
          <Route path="/students/new" element={<NewStudentScreen />} />
          <Route path="/students/:id" element={<StudentScreen />} />
          <Route path="/pages" element={<ResourceListScreen name="pages" />} />
          <Route path="/pages/:id" element={<PageScreen />} />
          <Route path="/r/:resource" element={<ResourceListScreen />} />
          <Route path="/r/:resource/:id" element={<ResourceEditScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/staff" element={<StaffScreen />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/recycle-bin" element={<RecycleBinScreen />} />
          <Route path="/finance/balances" element={<BalancesScreen />} />
          <Route path="/theory/results" element={<TheoryResultsScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </Layout>
    </AuthGate>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <AdminApp />
    </BrowserRouter>
  </StrictMode>,
);
