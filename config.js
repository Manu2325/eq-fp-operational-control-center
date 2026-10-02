const CONFIG = {
    // API Key de Google Cloud
    API_KEY: 'AIzaSyCp6lTY8MfexiQw5JaNyBxLlR1yvrS9DpI',

    // Duración de la caché local (5 minutos)
    CACHE_DURATION_MS: 5 * 60 * 1000,

    // Libro Maestro Consolidado (Directory, Commissions, Call Audits, Adherence)
    MASTER_SPREADSHEET_ID: '1LOSH8WFGuoUYJV6AW_T7AwtxGMcnjFsUs3TzUxbkflo',

    // Libros por Campaña (Productivity: Daily, Weekly, MTD)
    SERVICES: [
        {
            name: 'CRC_QC (Comcast Equipment)',
            spreadsheetId: '1wm9lypH0cB_3S13guFkdRf40x8nR8I8K43cWG6tnQkA'
        },
        {
            name: 'CRCC_QC (Comcast First Party)',
            spreadsheetId: '1SjglUQ9G2-JR9x-kUdaDPKr3cTVzRTjjkuT4W9Gpe2Y'
        },
        {
            name: 'Earthlink_QC (Earthlink Equipment)',
            spreadsheetId: '1r2sMMmlboQzoVcLPWFFhgcmzPatFQ5BhoI1mirjWiQc'
        },
        {
            name: 'FP_OPTIMUM (Optimum First Party)',
            spreadsheetId: '1nxzM-BR4zU8UTAVqLMElHWVnLkVAyLx3_6yB_W5d3DU'
        }
    ]
};