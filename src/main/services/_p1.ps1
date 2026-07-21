
# Fix 1: Replace handleAutoFill body (7 streams) + fix streamStates reset
$file = 'f:\All Project\AgentDeck\src\renderer\components\ProjectBlueprintPanel.tsx'

[System.IO.File]::WriteAllText($file + '.bak', [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8), [System.Text.Encoding]::UTF8)

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$IDLE7 = "{ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle', sec9agent: 'idle' }"

# --- Replace the whole handleAutoFill block ---
$startMarker = '  const handleAutoFill = async () => {'
$endMarker = '  const handleSendToAgent = async () => {'
$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0) { Write-Host "MARKER NOT FOUND"; exit 1 }

$before = $content.Substring(0, $startIdx)
$after  = $content.Substring($endIdx)

$IDLE7_OBJ = "{ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle', sec9agent: 'idle' }"

$newFunc = @"
  const handleAutoFill = async () => {
    if (!designVision.trim()) return;

    const isLlmConfigured = (llmProvider === 'ollama') || (llmApiKey.trim().length > 0);

    if (isLlmConfigured) {
      const ipc = window.agentDeck as any;
      if (!ipc?.generateDesignStream) {
        alert('generateDesignStream IPC not found. Please restart the app.');
        return;
      }

      setIsLlmLoading(true);
      setAutoFillStatus('idle');
      setStreamStates({ tokens: 'loading', sec12: 'loading', sec3: 'loading', sec4: 'loading', sec56: 'loading', sec78: 'loading', sec9agent: 'loading' });

      const settings = { provider: llmProvider, apiKey: llmApiKey, model: llmModel, baseUrl: llmBaseUrl };

      const applyTokens = (t: any) => {
        if (t.primaryColor)         { setPrimaryColor(t.primaryColor);               setPrimaryColorInput(t.primaryColor); }
        if (t.secondaryColor)       { setSecondaryColor(t.secondaryColor);           setSecondaryColorInput(t.secondaryColor); }
        if (t.backgroundColor)      { setBackgroundColor(t.backgroundColor);         setBackgroundColorInput(t.backgroundColor); }
        if (t.textColor)            { setTextColor(t.textColor);                     setTextColorInput(t.textColor); }
        if (t.borderRadius)         setBorderRadius(t.borderRadius);
        if (t.darkLightMode)        setDarkLightMode(t.darkLightMode);
        if (t.lightPrimaryColor)    { setLightPrimaryColor(t.lightPrimaryColor);     setLightPrimaryColorInput(t.lightPrimaryColor); }
        if (t.lightSecondaryColor)  { setLightSecondaryColor(t.lightSecondaryColor); setLightSecondaryColorInput(t.lightSecondaryColor); }
        if (t.lightBackgroundColor) { setLightBackgroundColor(t.lightBackgroundColor); setLightBackgroundColorInput(t.lightBackgroundColor); }
        if (t.lightTextColor)       { setLightTextColor(t.lightTextColor);           setLightTextColorInput(t.lightTextColor); }
        if (t.primaryFont)          setPrimaryFont(t.primaryFont);
        if (t.secondaryFont)        setSecondaryFont(t.secondaryFont);
        if (t.baseSpacing)          setBaseSpacing(t.baseSpacing);
        if (t.containerMaxWidth)    setContainerMaxWidth(t.containerMaxWidth);
        if (t.buttonHeight)         setButtonHeight(t.buttonHeight);
        if (t.cardPadding)          setCardPadding(t.cardPadding);
        if (t.cardShadow)           setCardShadow(t.cardShadow);
      };

      const mk = <K extends keyof typeof streamStates>(k: K, ok: boolean) =>
        setStreamStates(s => ({ ...s, [k]: ok ? 'done' : 'error' } as typeof s));

      try {
        const [r0, r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
          ipc.generateDesignStream(designVision, 'tokens',    settings).then((r: any) => { if (r?.ok && r.data?.tokens) applyTokens(r.data.tokens); mk('tokens', r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec12',     settings).then((r: any) => { mk('sec12',    r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec3',      settings).then((r: any) => { mk('sec3',     r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec4',      settings).then((r: any) => { mk('sec4',     r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec56',     settings).then((r: any) => { mk('sec56',    r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec78',     settings).then((r: any) => { mk('sec78',    r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec9agent', settings).then((r: any) => { if (r?.ok && r.data?.sec9agent) setAgentPrompt(r.data.sec9agent); mk('sec9agent', r?.ok); return r; }),
        ]);

        const get = (r: PromiseSettledResult<any>, key: string) =>
          r.status === 'fulfilled' && (r.value as any)?.ok ? (r.value as any).data?.[key] || '' : '';

        const merged = [get(r1,'sec12'), get(r2,'sec3'), get(r3,'sec4'), get(r4,'sec56'), get(r5,'sec78'), get(r6,'sec9agent')].filter(Boolean).join('\n\n');
        if (merged) setDesignSystemMarkdown(merged.trim());

        const allOk = [r0,r1,r2,r3,r4,r5,r6].every(r => r.status === 'fulfilled' && (r as any).value?.ok);
        if (allOk) {
          setAutoFillStatus('filled');
          setTimeout(() => { setAutoFillStatus('idle'); setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle', sec9agent: 'idle' }); }, 3500);
        } else {
          const keys: (keyof typeof streamStates)[] = ['tokens','sec12','sec3','sec4','sec56','sec78','sec9agent'];
          const results = [r0,r1,r2,r3,r4,r5,r6];
          const failed = keys.filter((_,i) => results[i].status !== 'fulfilled' || !(results[i] as any).value?.ok);
          if (failed.length) alert('Some streams failed: ' + failed.join(', ') + '. Partial results applied.');
          setTimeout(() => setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle', sec9agent: 'idle' }), 3500);
        }
      } catch (err) {
        console.error('Parallel generation failed:', err);
        setStreamStates({ tokens: 'error', sec12: 'error', sec3: 'error', sec4: 'error', sec56: 'error', sec78: 'error', sec9agent: 'error' });
        setTimeout(() => setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle', sec9agent: 'idle' }), 3500);
        alert('AI Generation Failed: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLlmLoading(false);
      }
      return;
    }

    // Local fallback
    const parsed = parseDesignKeywords(designVision);
    let newPri = primaryColor, newSec = secondaryColor, newBg = backgroundColor, newText = textColor;
    if (parsed.primary)   { setPrimaryColor(parsed.primary);     newPri = parsed.primary; }
    if (parsed.secondary) { setSecondaryColor(parsed.secondary); newSec = parsed.secondary; }
    if (parsed.bg)        { setBackgroundColor(parsed.bg);       newBg  = parsed.bg; }
    if (parsed.text)      { setTextColor(parsed.text);           newText = parsed.text; }
    if (parsed.radius)    setBorderRadius(parsed.radius);
    if (parsed.mode)      setDarkLightMode(parsed.mode);

    let brand = 'duolingo';
    const lowerVision = designVision.toLowerCase();
    for (const b of ['duolingo','linear','vercel','stripe','glassmorphism','neon','pastel','brutal','minimal']) {
      if (lowerVision.includes(b)) { brand = b; break; }
    }
    setDesignSystemMarkdown(getDesignSystemTemplate(brand, newPri, newSec, newBg, newText));
    setAutoFillStatus('filled');
    setTimeout(() => setAutoFillStatus('idle'), 2500);
  };

"@

$newContent = $before + $newFunc + $after
[System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "handleAutoFill patched (7 streams)"
