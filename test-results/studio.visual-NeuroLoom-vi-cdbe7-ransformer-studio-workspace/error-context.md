# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio.visual.spec.ts >> NeuroLoom visual baselines >> Transformer studio workspace
- Location: apps/studio/e2e/studio.visual.spec.ts:16:3

# Error details

```
Error: locator.click: Error: strict mode violation: locator('.panel--right .focus-group').filter({ has: getByText('Tokens', { exact: true }) }).locator('.focus-chip').filter({ hasText: 'glows' }) resolved to 2 elements:
    1) <button type="button" class="focus-chip">glows</button> aka getByRole('button', { name: 'glows' }).nth(1)
    2) <button type="button" class="focus-chip">glows</button> aka getByRole('button', { name: 'glows' }).nth(2)

Call log:
  - waiting for locator('.panel--right .focus-group').filter({ has: getByText('Tokens', { exact: true }) }).locator('.focus-chip').filter({ hasText: 'glows' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - paragraph [ref=e6]: NeuroLoom v1
      - heading "Neural networks, replayed as a precise 2.5D stage." [level=1] [ref=e7]
      - paragraph [ref=e8]:
        - text: NeuroLoom is a replay-first explainer for
        - code [ref=e9]: MLP
        - text: ","
        - code [ref=e10]: CNN
        - text: ", and standard"
        - code [ref=e11]: GPT-style Transformer
        - text: traces. It reconstructs one training or inference run into a controllable visual scene where glow, motion, and numeric truth stay in sync.
      - generic [ref=e12]:
        - generic [ref=e13]: Definition
        - strong [ref=e14]: NeuroLoom is a neural network replay explainer.
    - generic [ref=e15]:
      - article [ref=e16]:
        - generic [ref=e17]: Families
        - strong [ref=e18]: 3 official
        - paragraph [ref=e19]: MLP / CNN / Transformer
      - article [ref=e20]:
        - generic [ref=e21]: Modes
        - strong [ref=e22]: Story + Studio
        - paragraph [ref=e23]: Guided narrative and frame-by-frame analysis
      - article [ref=e24]:
        - generic [ref=e25]: Input
        - strong [ref=e26]: .loomtrace
        - paragraph [ref=e27]: Controlled replay bundle with schema validation
  - generic [ref=e28]:
    - button "mlp Spiral MLP Forward fan-out, loss anchor, backward pulse, and decision-boundary drift." [ref=e29] [cursor=pointer]:
      - generic [ref=e30]: mlp
      - strong [ref=e31]: Spiral MLP
      - paragraph [ref=e32]: Forward fan-out, loss anchor, backward pulse, and decision-boundary drift.
    - button "cnn Fashion CNN Stage-by-stage feature compression with feature-map mosaics and classifier lift." [ref=e33] [cursor=pointer]:
      - generic [ref=e34]: cnn
      - strong [ref=e35]: Fashion CNN
      - paragraph [ref=e36]: Stage-by-stage feature compression with feature-map mosaics and classifier lift.
    - button "transformer Tiny GPT Transformer Token rail, attention ribbons, residual stream, and decode stabilization." [ref=e37] [cursor=pointer]:
      - generic [ref=e38]: transformer
      - strong [ref=e39]: Tiny GPT Transformer
      - paragraph [ref=e40]: Token rail, attention ribbons, residual stream, and decode stabilization.
  - generic [ref=e41]:
    - generic [ref=e42]:
      - button "Story Mode" [ref=e43] [cursor=pointer]
      - button "Studio Mode" [active] [ref=e44] [cursor=pointer]
    - generic [ref=e45]:
      - generic [ref=e46]: Tiny GPT-style Transformer
      - generic [ref=e47]: transformer
      - generic [ref=e48]: 22 frames
      - generic "Official traces can be rebuilt locally in this browser. Scene rendering stays on the stable WebGL path." [ref=e49]: Browser regen • WebGL
    - generic [ref=e50]:
      - button "Freeze Focus" [ref=e51] [cursor=pointer]
      - button "Clear Focus" [disabled] [ref=e52]
      - button "Rebuild In Browser" [ref=e53] [cursor=pointer]
      - button "Export PNG" [ref=e54] [cursor=pointer]
      - generic [ref=e55] [cursor=pointer]: "Import `.loomtrace`"
      - 'button "Import `.loomtrace`" [ref=e56]'
  - main [ref=e57]:
    - complementary [ref=e58]:
      - generic [ref=e59]:
        - generic [ref=e60]:
          - generic [ref=e61]: Trace
          - strong [ref=e62]: A replay of token embedding, attention, residual flow, and decode stabilization.
        - paragraph [ref=e63]: A short prompt enters the embedding rail, fans out through attention, and converges into the next-token head.
      - generic [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]: Story Anchors
          - strong [ref=e67]: 3 stops
        - generic [ref=e68]:
          - button "Token Rail 0–6" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]: Token Rail
            - generic [ref=e71]: 0–6
          - button "Attention Ribbons 7–15" [ref=e72] [cursor=pointer]:
            - generic [ref=e73]: Attention Ribbons
            - generic [ref=e74]: 7–15
          - button "Decode Head 16–21" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]: Decode Head
            - generic [ref=e77]: 16–21
      - generic [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e80]: Structure
          - strong [ref=e81]: 11 nodes
        - generic [ref=e82]:
          - generic [ref=e83]:
            - generic [ref=e84]: Layer 0
            - button "<bos> token" [ref=e85] [cursor=pointer]:
              - generic [ref=e86]: <bos>
              - generic [ref=e87]: token
            - button "neuro token" [ref=e88] [cursor=pointer]:
              - generic [ref=e89]: neuro
              - generic [ref=e90]: token
            - button "loom token" [ref=e91] [cursor=pointer]:
              - generic [ref=e92]: loom
              - generic [ref=e93]: token
            - button "glows token" [ref=e94] [cursor=pointer]:
              - generic [ref=e95]: glows
              - generic [ref=e96]: token
          - generic [ref=e97]:
            - generic [ref=e98]: Layer 1
            - button "Embedding embedding" [ref=e99] [cursor=pointer]:
              - generic [ref=e100]: Embedding
              - generic [ref=e101]: embedding
          - generic [ref=e102]:
            - generic [ref=e103]: Layer 2
            - button "Attention attention" [ref=e104] [cursor=pointer]:
              - generic [ref=e105]: Attention
              - generic [ref=e106]: attention
            - button "Residual residual" [ref=e107] [cursor=pointer]:
              - generic [ref=e108]: Residual
              - generic [ref=e109]: residual
          - generic [ref=e110]:
            - generic [ref=e111]: Layer 3
            - button "MLP mlp" [ref=e112] [cursor=pointer]:
              - generic [ref=e113]: MLP
              - generic [ref=e114]: mlp
          - generic [ref=e115]:
            - generic [ref=e116]: Layer 4
            - button "Norm norm" [ref=e117] [cursor=pointer]:
              - generic [ref=e118]: Norm
              - generic [ref=e119]: norm
          - generic [ref=e120]:
            - generic [ref=e121]: Layer 5
            - button "Logits logits" [ref=e122] [cursor=pointer]:
              - generic [ref=e123]: Logits
              - generic [ref=e124]: logits
            - button "Decode decode" [ref=e125] [cursor=pointer]:
              - generic [ref=e126]: Decode
              - generic [ref=e127]: decode
      - generic [ref=e128]:
        - generic [ref=e129]:
          - generic [ref=e130]: Studio Tips
          - strong [ref=e131]: 3 prompts
        - generic [ref=e132]:
          - article [ref=e133]:
            - paragraph [ref=e135]: "Select `attn` to inspect the attention matrix as it sharpens across decode frames."
          - article [ref=e136]:
            - paragraph [ref=e138]: "Compare `residual` and `logits` selections to see how focus moves from transport to decision."
          - article [ref=e139]:
            - paragraph [ref=e141]: Use chapter jumps to isolate token rail, attention, and decode-head compositions.
    - generic [ref=e142]:
      - generic [ref=e143]:
        - generic [ref=e144]:
          - generic [ref=e145]:
            - generic [ref=e146]: Phase
            - strong [ref=e147]: forward
          - generic [ref=e148]:
            - generic [ref=e149]: Step
            - strong [ref=e150]: "0.0"
          - generic [ref=e151]:
            - generic [ref=e152]: Chapter
            - strong [ref=e153]: Token Rail
        - generic [ref=e155]:
          - generic [ref=e156]:
            - generic [ref=e157]: Render Lens
            - strong [ref=e158]: transformer
          - paragraph [ref=e159]: Attention ribbons
          - generic [ref=e160]:
            - generic "0.499" [ref=e161]
            - generic "0.525" [ref=e162]
            - generic "0.531" [ref=e163]
            - generic "0.502" [ref=e164]
            - generic "0.611" [ref=e165]
            - generic "0.74" [ref=e166]
            - generic "0.678" [ref=e167]
            - generic "0.572" [ref=e168]
            - generic "0.609" [ref=e169]
            - generic "0.659" [ref=e170]
            - generic "0.671" [ref=e171]
            - generic "0.514" [ref=e172]
            - generic "0.449" [ref=e173]
            - generic "0.435" [ref=e174]
            - generic "0.443" [ref=e175]
            - generic "0.499" [ref=e176]
          - generic [ref=e177]:
            - generic [ref=e178]:
              - generic [ref=e179]: entropy
              - strong [ref=e180]: "1.62"
            - generic [ref=e181]:
              - generic [ref=e182]: confidence
              - strong [ref=e183]: "0.280"
            - generic [ref=e184]:
              - generic [ref=e185]: decode progress
              - strong [ref=e186]: "0.000"
        - generic [ref=e187]:
          - generic [ref=e188]: Activation / forward flow
          - generic [ref=e190]: Compression / backward pressure
          - generic [ref=e192]: Selection / frozen focus
      - generic [ref=e198]:
        - generic [ref=e199]:
          - button "Prev" [ref=e200] [cursor=pointer]
          - button "Play" [ref=e201] [cursor=pointer]
          - button "Next" [ref=e202] [cursor=pointer]
          - button "PNG" [ref=e203] [cursor=pointer]
        - generic [ref=e204]:
          - slider [ref=e205]: "0"
          - generic [ref=e206]:
            - generic [ref=e207]: Frame 1 / 22
            - generic [ref=e208]: Token Rail
            - generic [ref=e209]: "`Space` play · `←/→` step · `S` export · `F` freeze · `Esc` clear"
            - generic [ref=e210]:
              - button "Prev Chapter" [ref=e211] [cursor=pointer]
              - button "Next Chapter" [ref=e212] [cursor=pointer]
    - complementary [ref=e213]:
      - generic [ref=e214]:
        - generic [ref=e215]:
          - generic [ref=e216]: Family Focus
          - strong [ref=e217]: transformer
        - paragraph [ref=e218]: "Select `attn` to inspect the attention matrix as it sharpens across decode frames."
        - generic [ref=e219]:
          - generic [ref=e220]:
            - generic [ref=e221]: Tokens
            - generic [ref=e222]:
              - button "<bos>" [ref=e223] [cursor=pointer]
              - button "neuro" [ref=e224] [cursor=pointer]
              - button "loom" [ref=e225] [cursor=pointer]
              - button "glows" [ref=e226] [cursor=pointer]
          - generic [ref=e227]:
            - generic [ref=e228]: Block
            - generic [ref=e229]:
              - button "Embedding" [ref=e230] [cursor=pointer]
              - button "Attention" [ref=e231] [cursor=pointer]
              - button "Residual" [ref=e232] [cursor=pointer]
              - button "MLP" [ref=e233] [cursor=pointer]
              - button "Norm" [ref=e234] [cursor=pointer]
          - generic [ref=e235]:
            - generic [ref=e236]: Decode
            - generic [ref=e237]:
              - button "Logits" [ref=e238] [cursor=pointer]
              - button "Decode" [ref=e239] [cursor=pointer]
        - generic [ref=e240]:
          - generic [ref=e241]:
            - generic [ref=e242]: Residual stream
            - strong [ref=e243]: attention slice
          - generic [ref=e244]:
            - generic "0.499" [ref=e245]
            - generic "0.525" [ref=e246]
            - generic "0.531" [ref=e247]
            - generic "0.502" [ref=e248]
            - generic "0.611" [ref=e249]
            - generic "0.74" [ref=e250]
            - generic "0.678" [ref=e251]
            - generic "0.572" [ref=e252]
            - generic "0.609" [ref=e253]
            - generic "0.659" [ref=e254]
            - generic "0.671" [ref=e255]
            - generic "0.514" [ref=e256]
            - generic "0.449" [ref=e257]
            - generic "0.435" [ref=e258]
            - generic "0.443" [ref=e259]
            - generic "0.499" [ref=e260]
      - generic [ref=e261]:
        - generic [ref=e262]:
          - generic [ref=e263]: Narrative Notes
          - strong [ref=e264]: Current chapter
        - paragraph [ref=e265]: Token embeddings compress the prompt into a dense latent rail.
      - generic [ref=e266]:
        - generic [ref=e267]:
          - generic [ref=e268]: Frame Metrics
          - strong [ref=e269]: 3 values
        - generic [ref=e270]:
          - article [ref=e271]:
            - generic [ref=e272]: Entropy
            - strong [ref=e273]: "1.62"
          - article [ref=e274]:
            - generic [ref=e275]: Confidence
            - strong [ref=e276]: "0.280"
          - article [ref=e277]:
            - generic [ref=e278]: Decode
            - strong [ref=e279]: "0.000"
      - generic [ref=e280]:
        - generic [ref=e281]:
          - generic [ref=e282]: Tensor Slice
          - strong [ref=e283]: Residual stream
        - generic [ref=e284]:
          - generic [ref=e285]:
            - generic [ref=e287]:
              - generic [ref=e288]: head sharpness
              - strong [ref=e289]: "0.320"
            - generic [ref=e293]:
              - generic [ref=e294]: residual norm
              - strong [ref=e295]: "0.840"
            - generic [ref=e299]:
              - generic [ref=e300]: top-1 prob
              - strong [ref=e301]: "0.280"
          - generic [ref=e304]:
            - generic "0.499" [ref=e305]
            - generic "0.525" [ref=e306]
            - generic "0.531" [ref=e307]
            - generic "0.502" [ref=e308]
            - generic "0.611" [ref=e309]
            - generic "0.74" [ref=e310]
            - generic "0.678" [ref=e311]
            - generic "0.572" [ref=e312]
            - generic "0.609" [ref=e313]
            - generic "0.659" [ref=e314]
            - generic "0.671" [ref=e315]
            - generic "0.514" [ref=e316]
            - generic "0.449" [ref=e317]
            - generic "0.435" [ref=e318]
            - generic "0.443" [ref=e319]
            - generic "0.499" [ref=e320]
      - generic [ref=e321]:
        - generic [ref=e322]:
          - generic [ref=e323]: Attention Explorer
          - strong [ref=e324]: Head 1
        - generic [ref=e325]:
          - generic [ref=e326]:
            - generic [ref=e327]: Heads
            - generic [ref=e328]:
              - button "Head 1" [ref=e329] [cursor=pointer]
              - button "Head 2" [ref=e330] [cursor=pointer]
              - button "Head 3" [ref=e331] [cursor=pointer]
              - button "Head 4" [ref=e332] [cursor=pointer]
          - generic [ref=e333]:
            - generic [ref=e334]: Tokens
            - generic [ref=e335]:
              - button "<bos>" [ref=e336] [cursor=pointer]
              - button "neuro" [ref=e337] [cursor=pointer]
              - button "loom" [ref=e338] [cursor=pointer]
              - button "glows" [ref=e339] [cursor=pointer]
        - generic [ref=e340]:
          - generic [ref=e341]:
            - generic [ref=e342]: Head 1 on <bos>
            - strong [ref=e343]: "0.340"
          - generic [ref=e344]:
            - generic "0.634" [ref=e345]
            - generic "0.647" [ref=e346]
            - generic "0.655" [ref=e347]
            - generic "0.656" [ref=e348]
            - generic "0.589" [ref=e349]
            - generic "0.68" [ref=e350]
            - generic "0.653" [ref=e351]
            - generic "0.61" [ref=e352]
            - generic "0.61" [ref=e353]
            - generic "0.652" [ref=e354]
            - generic "0.679" [ref=e355]
            - generic "0.587" [ref=e356]
            - generic "0.474" [ref=e357]
            - generic "0.473" [ref=e358]
            - generic "0.465" [ref=e359]
            - generic "0.454" [ref=e360]
        - generic [ref=e361]:
          - generic [ref=e363]:
            - generic [ref=e364]: <bos>
            - strong [ref=e365]: "0.634"
          - generic [ref=e369]:
            - generic [ref=e370]: neuro
            - strong [ref=e371]: "0.647"
          - generic [ref=e375]:
            - generic [ref=e376]: loom
            - strong [ref=e377]: "0.655"
          - generic [ref=e381]:
            - generic [ref=e382]: glows
            - strong [ref=e383]: "0.656"
        - generic [ref=e386]:
          - strong [ref=e387]: Decode candidates
          - generic [ref=e388]:
            - generic [ref=e389]:
              - generic [ref=e390]: glows
              - strong [ref=e391]: "0.340"
            - generic [ref=e392]:
              - generic [ref=e393]: bright
              - strong [ref=e394]: "0.220"
            - generic [ref=e395]:
              - generic [ref=e396]: again
              - strong [ref=e397]: "0.140"
      - generic [ref=e398]:
        - generic [ref=e399]:
          - generic [ref=e400]: Structure
          - strong [ref=e401]: embed
        - paragraph [ref=e402]: Select a node to inspect family-specific details.
```

# Test source

```ts
  1  | import { expect, type Page, test } from "@playwright/test";
  2  | 
  3  | test.describe("NeuroLoom visual baselines", () => {
  4  |   test("MLP story workspace", async ({ page }) => {
  5  |     await openTrace(page, "Spiral MLP", "Spiral MLP");
  6  |     await expect(page.locator(".workspace")).toHaveScreenshot("mlp-story-workspace.png");
  7  |   });
  8  | 
  9  |   test("CNN studio workspace", async ({ page }) => {
  10 |     await openTrace(page, "Fashion CNN", "Fashion-MNIST CNN");
  11 |     await page.getByRole("button", { name: "Studio Mode" }).click();
  12 |     await page.waitForTimeout(900);
  13 |     await expect(page.locator(".workspace")).toHaveScreenshot("cnn-studio-workspace.png");
  14 |   });
  15 | 
  16 |   test("Transformer studio workspace", async ({ page }) => {
  17 |     await openTrace(page, "Tiny GPT Transformer", "Tiny GPT-style Transformer");
  18 |     await page.getByRole("button", { name: "Studio Mode" }).click();
  19 |     await page
  20 |       .locator(".panel--right .focus-group")
  21 |       .filter({ has: page.getByText("Tokens", { exact: true }) })
  22 |       .locator(".focus-chip", { hasText: "glows" })
> 23 |       .click();
     |        ^ Error: locator.click: Error: strict mode violation: locator('.panel--right .focus-group').filter({ has: getByText('Tokens', { exact: true }) }).locator('.focus-chip').filter({ hasText: 'glows' }) resolved to 2 elements:
  24 |     await page.waitForTimeout(900);
  25 |     await expect(page.locator(".workspace")).toHaveScreenshot("transformer-studio-workspace.png");
  26 |   });
  27 | });
  28 | 
  29 | async function openTrace(page: Page, cardLabel: string, titleLabel: string) {
  30 |   await page.goto("/");
  31 |   await page.waitForSelector(".stage-frame canvas");
  32 | 
  33 |   if (cardLabel !== "Spiral MLP") {
  34 |     await page.getByRole("button", { name: cardLabel }).click();
  35 |   }
  36 | 
  37 |   await expect(page.locator(".toolbar__group--meta .meta-pill").first()).toContainText(titleLabel);
  38 |   await page.waitForTimeout(1200);
  39 | }
  40 | 
```