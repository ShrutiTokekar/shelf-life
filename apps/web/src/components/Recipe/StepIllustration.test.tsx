import { LOCAL_RECIPES } from '@shelf-life/shared/recipes';
import { describe, expect, it } from 'vitest';
import { SCENES, sceneFor } from './StepIllustration';

describe('StepIllustration (RCP-5)', () => {
  it.each([
    ['Wilt the spinach', 'Cook it in the pan until soft.', 'pan'],
    ['Cook the dal', 'Simmer until soft.', 'pot'],
    ['Blend', 'Blend the spinach until smooth.', 'blender'],
    ['Stir-fry', 'Stir-fry for 2 minutes.', 'wok'],
    ['Roast', 'Heat the oven to 220 °C.', 'tray'],
    ['Crisp', 'Cook the quesadillas until golden.', 'toast'],
    ['Prep everything first', 'Dice the carrot.', 'board'],
    ['Serve', 'Top with cilantro.', 'plate'],
    ['Rest', 'Leave it covered for 5 minutes.', 'rest'],
  ])('"%s" → %s', (title, text, scene) => {
    expect(sceneFor({ title, text })).toBe(scene);
  });

  it('every local recipe step gets a scene, and the set uses most of them', () => {
    const used = new Set(LOCAL_RECIPES.flatMap((r) => r.steps.map(sceneFor)));
    expect(used.size).toBeGreaterThanOrEqual(SCENES.length - 1);
  });
});
