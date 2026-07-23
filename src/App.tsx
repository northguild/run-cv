#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Box, Text, useApp } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import SelectInput from "ink-select-input";
import open from "open";
import { Fragment, useEffect, useState } from "react";
import { AccessDenied } from "./components/AccessDenied";
import { Hints } from "./components/Hints";
import { LoadingScreen } from "./components/LoadingScreen";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { SkillBadge } from "./components/SkillBadge";
import { getHuman, getPage } from "./cvParser";
import { useAppKeyboard } from "./hooks/use-app-keyboard";
import { theme } from "./styles/theme";
import type { HighlightedItem, HumanManifest, Page } from "./types";
import { executeMenuAction } from "./utils/menu-action-executor";
import {
  findMenuItemByValue,
  findMenuItemIndexByValue,
  getMenuSelectItems,
  resolveMenuAction,
} from "./utils/menu-actions";
// navigation helpers moved out of App
import {
  canDrillIn,
  computeHighlightedItem,
  computeNavigationHint,
} from "./utils/navigation-utils";
import { grabEmailPattern, grabLinkedInPattern } from "./utils/regex-utils";

interface AppProps {
  name?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PATH LOGIC:
 * 1. PROD: If we are in 'dist/index.js', the pdfs are in './pdf'
 * 2. DEV: If we are in 'src/App.tsx', the pdfs are in '../dist/pdf'
 */
function getPdfRoot() {
  // Try sibling 'pdf' folder (Production /dist/pdf)
  const prodPath = path.resolve(__dirname, "pdf");
  if (fs.existsSync(prodPath)) return prodPath;

  // Try sibling 'dist/pdf' (Dev root)
  const localDistPath = path.resolve(__dirname, "dist", "pdf");
  if (fs.existsSync(localDistPath)) return localDistPath;

  // Try upward 'dist/pdf' (Inside src/)
  const devPath = path.resolve(__dirname, "..", "dist", "pdf");
  if (fs.existsSync(devPath)) return devPath;

  // Fallback to current directory as a last resort
  return __dirname;
}

const PDF_ROOT = getPdfRoot();

export function App({ name }: AppProps) {
  const { exit } = useApp();
  const [human, setHuman] = useState<HumanManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Page[]>([]);
  const [gradientColors, setGradientColors] = useState([
    theme.terminalGreenBright,
    theme.terminalGreenMedium,
    theme.terminalGreenDark,
    theme.terminalGreenMedium,
    theme.terminalGreenBright,
  ]);
  const [navigationMemory, setNavigationMemory] = useState<
    Record<string, number>
  >({});
  const [highlightedItem, setHighlightedItem] =
    useState<HighlightedItem | null>(null);
  const [contactInfo, setContactInfo] = useState<{
    email?: string;
    linkedin?: string;
    portfolio?: string;
  }>({});

  useEffect(() => {
    const load = async () => {
      if (!name) {
        setError("Please provide a human name. Example: npx run-cv <name>");
        setLoading(false);
        return;
      }

      try {
        const data = await getHuman(name);
        setHuman(data);
        setHistory([data]);
      } catch {
        setError("ACCESS DENIED");
      }
    };
    load();
  }, [name]);

  const currentPage = history.length > 0 ? history[history.length - 1] : null;
  const isContactPage = currentPage?.file === "contact.md";

  // keep the highlighted item in sync when the page changes
  useEffect(() => {
    setHighlightedItem(computeHighlightedItem(currentPage, navigationMemory));
  }, [currentPage, navigationMemory]);

  useEffect(() => {
    if (isContactPage && currentPage) {
      const content = currentPage.content;
      const emailMatch = grabEmailPattern(content);
      const linkedinMatch = grabLinkedInPattern(content);
      setContactInfo((prev) => ({
        ...prev,
        email: emailMatch ? emailMatch[0] : undefined,
        linkedin: linkedinMatch ? linkedinMatch[0] : undefined,
      }));
    } else {
      setContactInfo((prev) => ({
        ...prev,
        email: undefined,
        linkedin: undefined,
      }));
    }
  }, [currentPage, isContactPage]);

  useEffect(() => {
    setContactInfo((prev) => ({
      ...prev,
      portfolio: human?.portfolio,
    }));
  }, [human]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGradientColors((prev) => {
        const newColors = [...prev];
        const first = newColors.shift();
        if (first) newColors.push(first);
        return newColors;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  useAppKeyboard({
    canGoBack: history.length > 1,
    hasError: !!error,
    isContactPage,
    highlightedItem,
    canUsePrimaryAction: canDrillIn(currentPage, highlightedItem),
    contactInfo,
    onBack: () => setHistory((prev) => prev.slice(0, -1)),
    onQuit: () => exit(),
    onPrimaryAction: handleSelect,
    onContactEmail: handleContactEmail,
    onContactLinkedIn: handleContactLinkedIn,
    onContactPortfolio: handleContactPortfolio,
  });

  async function handleSelect(item: { value: string }) {
    if (!currentPage || !human || !item) return;

    const selectedMenuItem = findMenuItemByValue(currentPage.menu, item.value);
    const selectedIndex = findMenuItemIndexByValue(
      currentPage.menu,
      item.value,
    );

    if (selectedIndex >= 0) {
      setNavigationMemory((prev) => ({
        ...prev,
        [currentPage.dir]: selectedIndex,
      }));
    }

    const action = resolveMenuAction(selectedMenuItem, human.name);

    await executeMenuAction({
      action,
      currentDir: currentPage.dir,
      pdfRoot: PDF_ROOT,
      loadPage: getPage,
      onNavigate: (nextPage) => setHistory((prev) => [...prev, nextPage]),
      onError: (message) => setError(message),
    });
  }

  function handleContactEmail() {
    if (!contactInfo.email) {
      return;
    }

    const subject = encodeURIComponent("Accessed run-cv, initiating comms");
    const body = encodeURIComponent(
      "Having navigated the digital tapestry of your run-cv, I'm reaching out to establish a more direct line of communication. I'm impressed with what I've seen and would like to discuss potential opportunities.",
    );

    open(`mailto:${contactInfo.email}?subject=${subject}&body=${body}`, {
      app: { name: "Mail" },
    });
  }

  function handleContactLinkedIn() {
    if (!contactInfo.linkedin) {
      return;
    }

    open(contactInfo.linkedin);
  }

  function handleContactPortfolio() {
    if (!contactInfo.portfolio) {
      return;
    }

    open(contactInfo.portfolio);
  }

  const navigationHint = computeNavigationHint(history);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={
        !loading && error ? theme.terminalRedBright : theme.terminalGreenBright
      }
      padding={1}
      width={80}
    >
      <Box marginBottom={1}>
        <Gradient
          colors={
            !loading && error
              ? [
                  theme.terminalRedBright,
                  theme.terminalRedMedium,
                  theme.terminalRedDark,
                ]
              : gradientColors
          }
        >
          <BigText text="RUN-CV" font="tiny" />
        </Gradient>
      </Box>

      {loading ? (
        <LoadingScreen onFinished={() => setLoading(false)} />
      ) : error ? (
        <AccessDenied />
      ) : human && currentPage ? (
        <Fragment>
          <Box marginBottom={1} flexDirection="column">
            <Text color={theme.terminalGreenBright}>User: {human.name}</Text>
            <Text color={theme.terminalGreenMedium}>Role: {human.role}</Text>
          </Box>

          <Box
            borderStyle="single"
            borderColor={theme.terminalGreenBright}
            padding={1}
            flexDirection="column"
          >
            {/* if we're showing the introduction page, render skill badges above */}
            {currentPage.file === human?.file &&
              human?.skills &&
              human.skills.length > 0 && (
                <Box flexDirection="row" flexWrap="wrap">
                  {human.skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} />
                  ))}
                </Box>
              )}

            {currentPage.menu ? (
              <Box flexDirection="column">
                <MarkdownRenderer content={currentPage.content} />
                <Box marginTop={1}>
                  <SelectInput
                    key={currentPage.dir}
                    items={getMenuSelectItems(currentPage.menu)}
                    onSelect={handleSelect}
                    onHighlight={setHighlightedItem}
                    initialIndex={navigationMemory[currentPage.dir] || 0}
                  />
                </Box>
                {navigationHint && (
                  <Box marginTop={1} borderStyle="single" borderColor="gray">
                    <Text color="gray">{navigationHint}</Text>
                  </Box>
                )}
              </Box>
            ) : (
              <Box flexDirection="column">
                <MarkdownRenderer content={currentPage.content} />
                {isContactPage && (
                  <Box flexDirection="column" marginTop={1}>
                    <Hints
                      hints={{
                        ...(contactInfo.email && { m: "Send email" }),
                        ...(contactInfo.linkedin && {
                          l: "Open LinkedIn profile",
                        }),
                        ...(contactInfo.portfolio && {
                          p: "Open portfolio",
                        }),
                      }}
                    />
                  </Box>
                )}
                {navigationHint && (
                  <Box
                    marginTop={1}
                    borderStyle="single"
                    borderColor={theme.terminalGreyMedium}
                  >
                    <Text color={theme.terminalGreyBright}>
                      {navigationHint}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Fragment>
      ) : null}
    </Box>
  );
}
