# SolisCloud Monitor

A self-hosted web dashboard for monitoring Solis solar inverters, batteries, and grid energy flow in real time. Built with Next.js 16, it connects to the [SolisCloud API](https://www.soliscloud.com/) via a server-side proxy and renders live data in the browser — no backend database required.

## Features

### Dashboard
- Aggregate view of all inverters on your station: total power output, daily/monthly/total generation, grid import/export, battery state, and home consumption.
- Status summary showing online, fault, and offline inverter counts.
- Quick-access inverter table linking to individual detail pages.

### Inverter Detail
- **Live Power Flow** — animated diagram showing real-time energy flow between solar panels, battery, home load, and grid.
- **Energy production** — today, month, and total generation figures.
- **Self-reliance & self-consumption** — percentage of your load met without grid and percentage of solar production used directly.
- **Cost analysis** — estimated savings from solar, grid import cost, and export revenue using your configured TOU (time-of-use) tariff rates.
- **Projected electricity cost** — daily average, weekly, and monthly cost estimates based on the current billing period.
- **Today's Power chart** — a line chart of solar, home load, battery charge/discharge, grid import, and grid export over the last 24 hours.
- **Energy Flow Breakdown** — daily bar chart of production, consumption, import, and export.
- **Load Shifting Analysis** — detailed TOU breakdown showing how much energy was imported and consumed during each tariff period (off-peak, day, peak, EV, etc.), with cost calculations and battery economics.

### Alarms
- Paginated list of inverter alarms pulled from SolisCloud, with severity badges (tip, general, serious, critical) and timestamps.

### Settings
- **API Credentials** — enter your SolisCloud API ID and Secret (stored in browser localStorage, or set via `SOLIS_API_ID` / `SOLIS_API_SECRET` environment variables).
- **Refresh Interval** — configurable polling interval for live data (default 5 minutes).
- **Tariff Groups** — define multiple TOU tariff periods with custom rates, time slots (including multi-slot groups like Night 11pm-2am + 6am-8am), and colours.
- **Off-peak Settings** — mark tariff groups as off-peak for load-shifting analysis.
- **Currency** — choose from EUR, USD, GBP, ZAR, AUD, CAD, CHF, JPY, INR, or BRL.
- **Export Price** — set your feed-in tariff rate for grid export revenue calculations.

## How It Works

```
Browser (SWR polling) --> /api/solis (Next.js Route Handler) --> SolisCloud API
```

1. The browser client uses [SWR](https://swr.vercel.app/) to poll the Next.js API proxy at a configurable interval.
2. The proxy route (`/api/solis`) signs each request using HMAC-SHA1 authentication (required by the SolisCloud API) and forwards it to `https://www.soliscloud.com:13333`.
3. API credentials are resolved from request headers first (browser-stored), falling back to server environment variables.
4. All settings (tariffs, currency, refresh interval, off-peak config) are stored in browser localStorage — there is no database dependency.

## Getting Started

### Prerequisites
- Node.js 18+
- A SolisCloud account with API access enabled ([request API access here](https://www.soliscloud.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/jouwdan/soliscloud-monitor.git
cd soliscloud-monitor

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your SolisCloud API ID and Secret on the setup screen.

### Environment Variables (optional)

Instead of entering credentials in the browser, you can set them as environment variables:

| Variable | Description |
|---|---|
| `SOLIS_API_ID` | Your SolisCloud API Key ID |
| `SOLIS_API_SECRET` | Your SolisCloud API Key Secret |

When set, these are used as fallbacks if no credentials are provided via the browser.

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jouwdan/soliscloud-monitor)

Add `SOLIS_API_ID` and `SOLIS_API_SECRET` as environment variables in your Vercel project settings, or enter them in the app after deployment.

## Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI** — [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Charts** — [Recharts](https://recharts.org/)
- **Data Fetching** — [SWR](https://swr.vercel.app/)
- **API** — [SolisCloud API v2](https://www.soliscloud.com/)

## License

MIT
