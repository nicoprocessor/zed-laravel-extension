import { Connection } from "vscode-languageserver/node";
import { createRepository, Repository } from "./index";
import { runInLaravel, template } from "../support/php";
import "../templates/views";

export interface ViewItem {
  key: string;
  path: string;
  isVendor: boolean;
}

let viewsRepo: Repository<ViewItem[]> | null = null;

export function initViewsRepository(connection: Connection): void {
  viewsRepo = createRepository<ViewItem[]>({
    load: async () => {
      const code = template("views", {});
      const result = await runInLaravel<ViewItem[]>(code, "views");
      return result ?? [];
    },
    itemsDefault: [],
    connection,
    name: "views",
  });
}

export function getViews(): ViewItem[] {
  return viewsRepo?.items ?? [];
}

export function reloadViews(): Promise<void> {
  return viewsRepo?.reload() ?? Promise.resolve();
}
