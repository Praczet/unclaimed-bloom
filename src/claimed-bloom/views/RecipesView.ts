import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import type { SporeRecipe } from "../services/types.ts";

export function createRecipesView(context: ViewContext): View {
  const view = createMenuView(context.renderer, context, "Recipes — Select a target", []);

  view.setMessage?.("Loading targets...");

  void context.spore
    .getTargets()
    .then((targets) => {
      view.setItems?.(
        targets.map((target) => ({
          onSelect: () => {
            void showRecipesForTarget(context, target.target);
          },
          label: `${target.target}`,
          description: `Target:  ${target.target}\nRecipes: ${target.recipes}\nHook:    ${target.hook ? "" : ""}`,
        })),
      );

      if (targets.length === 0) {
        view.setMessage?.("No targets found.");
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      view.setMessage?.(`Failed to load targets: ${message}`);
    });

  async function showRecipesForTarget(context: ViewContext, target: string): Promise<void> {
    const recipes = await context.spore.getRecipes(target);
    openRecipeDialog(context, target, recipes);
  }

  function openRecipeDialog(context: ViewContext, target: string, recipes: SporeRecipe[]): void {
    context.openChoiceDialog({
      title: `Recipes — ${target}`,

      items: recipes.map((recipe) => ({
        label: recipe.name,
        value: recipe,
        description:
          `ID:     ${recipe.id}\n` +
          `Base:   ${recipe.basePalette ?? "(profile)"}\n` +
          `Tokens: ${recipe.tokenCount}\n` +
          `Path:   ${recipe.path}`,
      })),

      onSelect: (recipe) => {
        context.navigate({
          name: "recipe",
          id: recipe.id,
        });
      },
    });
  }
  return view;
}
