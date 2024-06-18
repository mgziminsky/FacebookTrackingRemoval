// This file is just for the IDE to provide code-assist

interface HideRule {
    selector: string;
    texts?: Map<string, string>;
    patterns?: RegExp;
}

interface HideRules {
    article_wrapper: string;
    sponsored: HideRule;
    suggested: HideRule;
    pending: HideRule;
}

interface ParamCleaning {
    params: string[];
    prefix_patterns: string[];
    values: string[];
    pattern: RegExp;
}

interface ClickWhitelist {
    elements: string[];
    roles: string[];
    selectors: string[];
    selector: string;
}

interface Options {
    enabled: boolean;
    fixLinks: boolean;
    internalRefs: boolean;
    inlineVids: boolean;
    fixVideos: boolean;
    delPixeled: boolean;
    delSuggest: boolean;
    hideMethod: string;
    useStyle: boolean;
    logging: boolean;
    modStyle: string;
    userRules: string;
    pendingRules: boolean;
    testCanvas: boolean;
    canvasSensitivity: number;
}
