import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Root from "./routes/root";
import ErrorPage from "./error-page";
import Home from "./routes/Home";
import LiveGamePage from "./routes/play_friends_live/LivePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "live-game/",
        element: <LiveGamePage />,
        errorElement: <ErrorPage />,
        children: [
          {
            path: "setup/",
            lazy: async () => ({ Component: (await import("./routes/play_friends_live/setup/Setup")).default }),
          },
          {
            path: "game/",
            lazy: async () => ({ Component: (await import("./routes/play_friends_live/game/Game")).default }),
          },
          {
            path: "how-to-play/",
            lazy: async () => ({ Component: (await import("./routes/HowToPlay")).default }),
          },
        ]},
      {
        path: "leaderboard/",
        lazy: async () => ({ Component: (await import("./routes/Leaderboard")).default }),
      },
      {
        path: "players/:name",
        lazy: async () => ({ Component: (await import("./routes/PlayerStats")).default }),
      },
      {
        path: "/",
        element: <Home />,
      },
    
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
