import { expect, test } from "@playwright/test";

test("valida, demuestra, guarda y exporta un análisis", async ({ page }) => {
  await page.goto("/analizar");
  // Confirma que React ya hidrató la página antes de probar el envío del formulario.
  const demoMode = page.getByRole("button", { name: "Demostración", exact: true });
  await demoMode.click();
  await expect(demoMode).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Análisis real" }).click();
  await page.getByLabel("Nombre de dominio").fill("https://example.com");
  await page.getByRole("button", { name: "Analizar dominio" }).click();
  await expect(page.locator("#analysis-error")).toContainText("solo el nombre de dominio");

  await page.getByRole("button", { name: "Demostración" }).click();
  await page.getByLabel("Escenario").selectOption("persistent_mismatch");
  await page.getByRole("button", { name: "Mostrar demostración" }).click();
  await expect(page.getByText("Datos simulados para demostración", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Posible inconsistencia DNS/ })).toBeVisible();
  await page.getByRole("button", { name: "Guardar en historial" }).click();
  await expect(page.getByRole("heading", { name: "Matriz de consenso" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Modo sustentación" }).click();
  await expect(page.getByRole("dialog", { name: "Modo sustentación" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("2 / 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar modo sustentación" }).click();
  await expect(page.getByRole("dialog", { name: "Modo sustentación" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar informe PDF" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto("/historial");
  await expect(page.getByText("demostracion.example").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/dnsspoofdetector-.*\.json/);
});
