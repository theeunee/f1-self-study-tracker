import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Gate } from './data/auth';
import { Shell } from './shell/Shell';
import { HomePage } from './pages/home/HomePage';
import { RaceWeekPage } from './pages/raceweek/RaceWeekPage';
import { GoalsPage } from './pages/goals/GoalsPage';

export function App() {
  return (
    <Gate>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="race-week" element={<RaceWeekPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Gate>
  );
}
