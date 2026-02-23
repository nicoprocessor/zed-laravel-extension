import { Connection } from "vscode-languageserver/node";
import { createRepository, Repository } from "./index";
import { runInLaravel, template } from "../support/php";
import "../templates/routes";

export interface RouteItem {
  method: string;
  uri: string;
  name: string | null;
  action: string;
  parameters: string[];
  filename: string | null;
  line: number | null;
}

let routesRepo: Repository<RouteItem[]> | null = null;

export function initRoutesRepository(connection: Connection): void {
  routesRepo = createRepository<RouteItem[]>({
    load: async () => {
      const code = template("routes", {});
      const result = await runInLaravel<RouteItem[]>(code, "routes");
      return result ?? [];
    },
    itemsDefault: [],
    connection,
    name: "routes",
  });
}

export function getRoutes(): RouteItem[] {
  return routesRepo?.items ?? [];
}

export function reloadRoutes(): Promise<void> {
  return routesRepo?.reload() ?? Promise.resolve();
}
