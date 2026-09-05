import {
	Bank,
	Buildings,
	Coins,
	HandFist,
	HardHat,
	Leaf,
	Megaphone,
	PawPrint,
	Scales,
	ShieldWarning
} from 'phosphor-svelte';
import type { Component } from 'svelte';
import type { IconComponentProps } from 'phosphor-svelte';

// Keep in sync with the `icon` field in data/categories.json.
export const CATEGORY_ICONS: Record<
	string,
	Component<IconComponentProps, Record<string, never>, ''>
> = {
	Megaphone,
	HandFist,
	HardHat,
	Leaf,
	PawPrint,
	Scales,
	Coins,
	Bank,
	ShieldWarning,
	Buildings
};
