import { ReactNode } from 'react';

declare module '@/components/ui/card' {
	export interface CardProps {
		children?: ReactNode;
		className?: string;
	}

	export interface CardHeaderProps {
		children?: ReactNode;
		className?: string;
	}

	export interface CardContentProps {
		children?: ReactNode;
		className?: string;
	}

	export interface CardTitleProps {
		children?: ReactNode;
		className?: string;
	}

	export interface CardDescriptionProps {
		children?: ReactNode;
		className?: string;
	}

	export interface CardFooterProps {
		children?: ReactNode;
		className?: string;
	}

	export const Card: React.FC<CardProps>;
	export const CardHeader: React.FC<CardHeaderProps>;
	export const CardContent: React.FC<CardContentProps>;
	export const CardTitle: React.FC<CardTitleProps>;
	export const CardDescription: React.FC<CardDescriptionProps>;
	export const CardFooter: React.FC<CardFooterProps>;
}
