import type { MenuItem, View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { ACTIONS, suggestAction, type Action } from "../services/actions.ts";
import { ChangesScanner } from "../services/ChangesScanner.ts";

export function createDoView(context: ViewContext): View {
  const view = createMenuView(
    context.renderer,
    context,
    "Do:=> sync dev into config and re-apply the theme",
    [],
    ["↑↓ Navigate", "Enter Run", "ESC => back", "q => Quit"],
  );

  view.setMessage?.("Checking what needs doing...");

  void new ChangesScanner(context.spore)
    .scan()
    .then((report) => {
      const suggestion = suggestAction(report);
      const suggested: MenuItem = suggestion.action
        ? {
          label: `★ ${suggestion.action.label}`,
          description: `Suggested.\n\n${suggestion.why}\n\n${suggestion.action.description}`,
          onSelect: () => run(context, suggestion.action!),
        }
        : {
          label: "★ Nothing to do",
          description: suggestion.why,
          onSelect: () => context.navigate("check"),
        };

      view.setItems?.([
        suggested,
        ...ACTIONS.filter((action) => action !== suggestion.action).map((action): MenuItem => ({
          label: `  ${action.label}`,
          description: action.confirm ? `${action.description}\n\nAsks before running.` : action.description,
          onSelect: () => run(context, action),
        })),
      ]);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      view.setMessage?.(`Failed to check: ${message}`);
    });

  return view;
}

function run(context: ViewContext, action: Action): void {
  if (!action.confirm) {
    context.navigate({ name: "run", id: action.id });
    return;
  }

  context.openChoiceDialog({
    title: action.label,
    items: [
      { label: "No, go back", value: false, description: action.confirm },
      { label: `Yes, run ${action.label}`, value: true, description: action.description },
    ],
    onSelect: (confirmed) => {
      if (confirmed) context.navigate({ name: "run", id: action.id });
    },
  });
}
