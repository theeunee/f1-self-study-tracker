import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Gate } from './data/auth';
import { Shell } from './shell/Shell';
import { HomePage } from './pages/home/HomePage';
import { RaceWeekPage } from './pages/raceweek/RaceWeekPage';
import { GoalsPage } from './pages/goals/GoalsPage';

// A data router, so Race week can hold navigation while Mechanics mode has unsaved changes.
const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'race-week', element: <RaceWeekPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <Gate>
      <RouterProvider router={router} />
    </Gate>
  );
}
