/**
 * Type definitions for TruthLens findings
 */

export interface FindingsReport {
	version: string;
	generatedAt: string;
	repository: {
		root: string;
		commit: string;
		branch?: string;
	};
	summary: {
		total: number;
		critical: number;
		high: number;
		medium: number;
		low: number;
		byCategory: {
			'CAT-A': number;
			'CAT-B': number;
			'CAT-C': number;
			'CAT-D': number;
		};
	};
	findings: Finding[];
}

export interface Finding {
	id: string;
	category: 'CAT-A' | 'CAT-B' | 'CAT-C' | 'CAT-D';
	severity: 'critical' | 'high' | 'medium' | 'low';
	confidence: number;
	file: string;
	line: number;
	endLine?: number;
	claim: {
		text: string;
		source: 'function_name' | 'docstring' | 'test_name' | 'comment' | 'documentation';
		extractedFrom: string;
	};
	reality: {
		description: string;
		evidence: string | string[];
	};
	blastRadius: {
		callerCount: number;
		affectedFiles: string[];
	};
	suggestedFix: {
		strategy: 'rename_artifact' | 'fix_implementation' | 'update_documentation' | 'add_validation';
		summary: string;
		estimatedEffort?: 'trivial' | 'small' | 'medium' | 'large';
	};
	status: 'open' | 'resolved' | 'dismissed';
	resolvedAt?: string;
	resolvedBy?: string;
}

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type CategoryType = 'CAT-A' | 'CAT-B' | 'CAT-C' | 'CAT-D';
