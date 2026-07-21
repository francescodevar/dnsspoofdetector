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
  await page.getByLabel("Escenario").selectOption("possible_inconsistency");
  await page.getByRole("button", { name: "Mostrar demostración" }).click();
  await expect(page.getByText("Datos simulados para demostración", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Posible inconsistencia DNS/ })).toBeVisible();
  await page.getByRole("button", { name: "Guardar en historial" }).click();

  await page.goto("/historial");
  await expect(page.getByText("demostracion.example").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/dnsspoofdetector-.*\.json/);
});
