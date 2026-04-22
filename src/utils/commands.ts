import type { Command, LastCommandStatus } from '@/src/types';

export function upsertCommand(commands: Command[], command: Command) {
  return [command, ...commands.filter((entry) => entry.id !== command.id)].slice(0, 12);
}

export function updateCommandStatus(
  commands: Command[],
  commandId: string,
  status: LastCommandStatus,
) {
  return commands.map((command) =>
    command.id === commandId ? { ...command, status } : command,
  );
}

export function getLatestCommandId(commands: Command[]) {
  return commands[0]?.id;
}
