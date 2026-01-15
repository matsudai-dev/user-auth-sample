interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_SERVER_SECRET_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
