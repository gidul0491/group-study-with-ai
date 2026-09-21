import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "@style/config.js";
import "./app.css";
import { shell, shellColumn } from "@shared/ui/layout.style";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>그룹 스터디</Title>
          <div class={shell}>
            <div class={shellColumn}>
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
