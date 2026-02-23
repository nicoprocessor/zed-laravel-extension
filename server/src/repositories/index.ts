import { Connection } from "vscode-languageserver/node";

export interface Repository<T> {
  loaded: boolean;
  items: T;
  reload: () => Promise<void>;
}

export interface RepositoryConfig<T> {
  load: () => Promise<T>;
  itemsDefault: T;
  connection: Connection;
  name: string;
}

export const createRepository = <T>(
  config: RepositoryConfig<T>
): Repository<T> => {
  const repo: Repository<T> = {
    loaded: false,
    items: config.itemsDefault,
    reload: async () => {
      try {
        const result = await config.load();
        if (result !== undefined) {
          repo.items = result;
          repo.loaded = true;
          const count = Array.isArray(result) ? result.length : 'N/A';
          config.connection.console.log(
            `Repository "${config.name}" loaded (${count} items).`
          );
        }
      } catch (e) {
        config.connection.console.error(
          `Repository "${config.name}" failed: ${e}`
        );
      }
    },
  };

  repo.reload();

  return repo;
};
