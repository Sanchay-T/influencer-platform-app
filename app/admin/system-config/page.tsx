'use client';

import {
	AlertTriangle,
	CheckCircle,
	Clock,
	Database,
	RefreshCw,
	Save,
	Settings,
	Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/app/components/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { adminLogger } from '@/lib/logging';
import { useComponentLogger, useUserActionLogger } from '@/lib/logging/react-logger';
import { hasOwn } from '@/lib/utils/type-guards';

interface Configuration {
	id: string;
	category: string;
	key: string;
	value: string;
	valueType: string;
	description: string;
	isHotReloadable: string;
	createdAt: string;
	updatedAt: string;
}

interface ConfigData {
	configurations: Record<string, Configuration[]>;
	categories: string[];
	totalCount: number;
}

const VALUE_TYPES = ['number', 'duration', 'boolean'];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
	api_limits: 'API call limits and rate limiting settings',
	qstash_delays: 'QStash message delays and scheduling',
	timeouts: 'Job timeout and processing limits',
	polling: 'Frontend polling intervals',
	cache: 'Cache duration settings',
	processing: 'Background processing settings',
	cleanup: 'Job cleanup and retention rules',
};

const CATEGORY_ICONS: Record<string, string> = {
	api_limits: '🔒',
	qstash_delays: '⏱️',
	timeouts: '⏰',
	polling: '🔄',
	cache: '💾',
	processing: '⚙️',
	cleanup: '🧹',
};

const resolveErrorMessage = (err: unknown) =>
	err instanceof Error ? err.message : 'Unexpected error';

function SystemConfigPageContent() {
	const componentLogger = useComponentLogger('SystemConfigPage');
	const userActionLogger = useUserActionLogger();
	const [configData, setConfigData] = useState<ConfigData | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [initLoading, setInitLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
	const [newConfigData, setNewConfigData] = useState({
		category: '',
		key: '',
		value: '',
		valueType: 'number',
		description: '',
	});

	// Load configurations
	const loadConfigurations = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch('/api/admin/config');
			if (!response.ok) {
				throw new Error(`Failed to load configurations: ${response.statusText}`);
			}

			const data = await response.json();
			setConfigData(data);
		} catch (err: unknown) {
			setError(resolveErrorMessage(err));
			adminLogger.error(
				'Error loading configurations',
				err instanceof Error ? err : new Error(String(err)),
				{
					metadata: {
						operation: 'load-configurations',
					},
				}
			);
		} finally {
			setLoading(false);
		}
	};

	// Initialize default configurations
	const initializeDefaults = async () => {
		try {
			setInitLoading(true);
			setError(null);

			const response = await fetch('/api/admin/config/init', {
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error(`Failed to initialize: ${response.statusText}`);
			}

			await loadConfigurations();
		} catch (err: unknown) {
			setError(resolveErrorMessage(err));
			adminLogger.error(
				'Error initializing defaults',
				err instanceof Error ? err : new Error(String(err)),
				{
					metadata: {
						operation: 'initialize-defaults',
					},
				}
			);
		} finally {
			setInitLoading(false);
		}
	};

	// Save configuration
	const saveConfiguration = async (config: Partial<Configuration>) => {
		try {
			setSaving(true);
			setError(null);

			const response = await fetch('/api/admin/config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(config),
			});

			if (!response.ok) {
				throw new Error(`Failed to save configuration: ${response.statusText}`);
			}

			await loadConfigurations();
			setEditingConfig(null);
			setNewConfigData({
				category: '',
				key: '',
				value: '',
				valueType: 'number',
				description: '',
			});
		} catch (err: unknown) {
			setError(resolveErrorMessage(err));
			adminLogger.error(
				'Error saving configuration',
				err instanceof Error ? err : new Error(String(err)),
				{
					metadata: {
						operation: 'save-configuration',
						configKey: config.key,
						configCategory: config.category,
					},
				}
			);
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		loadConfigurations();
	}, []);

	if (loading) {
		return (
			<div className="container mx-auto p-6">
				<div className="flex items-center justify-center h-64">
					<RefreshCw className="h-8 w-8 animate-spin" />
					<span className="ml-2">Loading configurations...</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto p-6">
				<Card className="border-red-200 bg-red-50">
					<CardHeader>
						<CardTitle className="flex items-center text-red-700">
							<AlertTriangle className="h-5 w-5 mr-2" />
							Error Loading Configurations
						</CardTitle>
						<CardDescription className="text-red-600">{error}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={loadConfigurations} variant="outline">
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold flex items-center">
							<Settings className="h-8 w-8 mr-3" />
							System Configuration
						</h1>
						<p className="text-gray-600 mt-2">
							Manage timing, scheduling, and performance configurations
						</p>
					</div>

					<div className="flex gap-2">
						<Button variant="outline" onClick={loadConfigurations} disabled={loading}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>

						<Button variant="secondary" onClick={initializeDefaults} disabled={initLoading}>
							<Database className="h-4 w-4 mr-2" />
							{initLoading ? 'Initializing...' : 'Init Defaults'}
						</Button>
					</div>
				</div>

				{configData && (
					<div className="flex items-center gap-4 mt-4">
						<Badge variant="secondary">{configData.totalCount} Configurations</Badge>
						<Badge variant="secondary">{configData.categories.length} Categories</Badge>
					</div>
				)}
			</div>

			{/* Add New Configuration */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Add New Configuration</CardTitle>
					<CardDescription>Create a new system configuration setting</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
						<div>
							<Label htmlFor="new-category">Category</Label>
							<Input
								id="new-category"
								value={newConfigData.category}
								onChange={(e) => setNewConfigData({ ...newConfigData, category: e.target.value })}
								placeholder="e.g., api_limits"
							/>
						</div>

						<div>
							<Label htmlFor="new-key">Key</Label>
							<Input
								id="new-key"
								value={newConfigData.key}
								onChange={(e) => setNewConfigData({ ...newConfigData, key: e.target.value })}
								placeholder="e.g., max_api_calls"
							/>
						</div>

						<div>
							<Label htmlFor="new-value">Value</Label>
							<Input
								id="new-value"
								value={newConfigData.value}
								onChange={(e) => setNewConfigData({ ...newConfigData, value: e.target.value })}
								placeholder="e.g., 5 or 2s"
							/>
						</div>

						<div>
							<Label htmlFor="new-type">Type</Label>
							<Select
								value={newConfigData.valueType}
								onValueChange={(value) => setNewConfigData({ ...newConfigData, valueType: value })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{VALUE_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-end">
							<Button
								onClick={() => {
									userActionLogger.logClick('add-new-configuration', {
										metadata: {
											category: newConfigData.category,
											key: newConfigData.key,
											valueType: newConfigData.valueType,
										},
									});

									adminLogger.info('Adding new configuration', {
										metadata: {
											category: newConfigData.category,
											key: newConfigData.key,
											valueType: newConfigData.valueType,
											operation: 'add-config-attempt',
										},
									});

									saveConfiguration(newConfigData);
								}}
								disabled={
									!(newConfigData.category && newConfigData.key && newConfigData.value) || saving
								}
								className="w-full"
							>
								<Save className="h-4 w-4 mr-2" />
								{saving ? 'Saving...' : 'Add'}
							</Button>
						</div>
					</div>

					<div className="mt-4">
						<Label htmlFor="new-description">Description (Optional)</Label>
						<Textarea
							id="new-description"
							value={newConfigData.description}
							onChange={(e) => setNewConfigData({ ...newConfigData, description: e.target.value })}
							placeholder="Describe what this configuration controls..."
							rows={2}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Configuration Categories */}
			{configData && Object.keys(configData.configurations).length > 0 ? (
				<div className="grid gap-6">
					{Object.entries(configData.configurations).map(([category, configs]) => (
						<Card key={category}>
							<CardHeader>
								<CardTitle className="flex items-center">
									<span className="text-2xl mr-2">
										{hasOwn(CATEGORY_ICONS, category) ? CATEGORY_ICONS[category] : '⚙️'}
									</span>
									{category.replace('_', ' ').toUpperCase()}
									<Badge variant="outline" className="ml-2">
										{configs.length} items
									</Badge>
								</CardTitle>
								<CardDescription>
									{hasOwn(CATEGORY_DESCRIPTIONS, category)
										? CATEGORY_DESCRIPTIONS[category]
										: 'System configuration settings'}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{configs.map((config) => (
										<div key={config.id} className="border rounded-lg p-4">
											<div className="flex items-center justify-between">
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-2">
														<code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
															{config.key}
														</code>
														<Badge
															variant={config.valueType === 'duration' ? 'default' : 'secondary'}
														>
															{config.valueType}
														</Badge>
														{config.isHotReloadable === 'true' ? (
															<Badge variant="outline">
																<Zap className="h-3 w-3 mr-1" />
																Hot Reload
															</Badge>
														) : (
															<Badge variant="outline">
																<Clock className="h-3 w-3 mr-1" />
																Restart Required
															</Badge>
														)}
													</div>

													{editingConfig?.id === config.id ? (
														<div className="space-y-2">
															<Input
																value={editingConfig.value}
																onChange={(e) =>
																	setEditingConfig({ ...editingConfig, value: e.target.value })
																}
																placeholder="Configuration value"
															/>
															<Textarea
																value={editingConfig.description || ''}
																onChange={(e) =>
																	setEditingConfig({
																		...editingConfig,
																		description: e.target.value,
																	})
																}
																placeholder="Description..."
																rows={2}
															/>
															<div className="flex gap-2">
																<Button
																	size="sm"
																	onClick={() => {
																		userActionLogger.logClick('save-configuration-edit', {
																			metadata: {
																				configId: editingConfig.id,
																				configKey: editingConfig.key,
																				configCategory: editingConfig.category,
																			},
																		});

																		adminLogger.info('Saving configuration edit', {
																			metadata: {
																				configId: editingConfig.id,
																				configKey: editingConfig.key,
																				configCategory: editingConfig.category,
																				newValue: editingConfig.value,
																				operation: 'save-config-edit',
																			},
																		});

																		saveConfiguration(editingConfig);
																	}}
																>
																	<Save className="h-4 w-4 mr-1" />
																	Save
																</Button>
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => setEditingConfig(null)}
																>
																	Cancel
																</Button>
															</div>
														</div>
													) : (
														<div>
															<div className="text-lg font-semibold mb-1">{config.value}</div>
															{config.description && (
																<p className="text-sm text-gray-600 mb-2">{config.description}</p>
															)}
															<div className="text-xs text-gray-500">
																Updated: {new Date(config.updatedAt).toLocaleString()}
															</div>
														</div>
													)}
												</div>

												{editingConfig?.id !== config.id && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															userActionLogger.logClick('edit-configuration', {
																metadata: {
																	configId: config.id,
																	configKey: config.key,
																	configCategory: config.category,
																},
															});

															componentLogger.logInfo('Configuration edit started', {
																metadata: {
																	configId: config.id,
																	configKey: config.key,
																	configCategory: config.category,
																	operation: 'start-config-edit',
																},
															});

															setEditingConfig(config);
														}}
													>
														Edit
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Card>
					<CardContent className="text-center py-12">
						<Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Configurations Found</h3>
						<p className="text-gray-600 mb-4">Initialize default configurations to get started</p>
						<Button onClick={initializeDefaults} disabled={initLoading}>
							<Database className="h-4 w-4 mr-2" />
							{initLoading ? 'Initializing...' : 'Initialize Defaults'}
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default function SystemConfigPage() {
	return (
		<ErrorBoundary componentName="SystemConfigPage">
			<SystemConfigPageContent />
		</ErrorBoundary>
	);
}
