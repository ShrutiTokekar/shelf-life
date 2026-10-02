import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Recipe, SavedRecipe } from '@shelf-life/shared';
import { localRecipe } from '@shelf-life/shared/recipes';
import type { Db } from '../db/client';
import { schema } from '../db/client';

/** A local recipe (shipped with the app) or an AI recipe kept in `recipe`. */
export async function findRecipe(db: Db, id: string): Promise<Recipe | null> {
  const local = localRecipe(id);
  if (local) return local;
  const [row] = await db.select().from(schema.recipe).where(eq(schema.recipe.id, id)).limit(1);
  return row?.payload ?? null;
}

/** SAV-1: the user's saved recipes, newest first. */
export async function listSaved(db: Db, userId: string): Promise<SavedRecipe[]> {
  const saved = await db
    .select()
    .from(schema.savedRecipe)
    .where(eq(schema.savedRecipe.userId, userId))
    .orderBy(desc(schema.savedRecipe.savedAt));
  const aiIds = saved.map((s) => s.recipeId).filter((id) => !localRecipe(id));
  const rows = aiIds.length
    ? await db.select().from(schema.recipe).where(inArray(schema.recipe.id, aiIds))
    : [];
  const ai = new Map(rows.map((r) => [r.id, r.payload]));
  return saved.flatMap((s) => {
    const recipe = localRecipe(s.recipeId) ?? ai.get(s.recipeId);
    return recipe ? [{ recipe, savedAt: s.savedAt.toISOString() }] : [];
  });
}

/** SAV-2: save (idempotent). Returns false when the recipe doesn't exist. */
export async function saveRecipe(db: Db, userId: string, recipeId: string): Promise<boolean> {
  if (!(await findRecipe(db, recipeId))) return false;
  await db.insert(schema.savedRecipe).values({ userId, recipeId }).onConflictDoNothing();
  return true;
}

export async function unsaveRecipe(db: Db, userId: string, recipeId: string) {
  await db
    .delete(schema.savedRecipe)
    .where(and(eq(schema.savedRecipe.userId, userId), eq(schema.savedRecipe.recipeId, recipeId)));
}
