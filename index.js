import config from "./config.json";
import htmlTemplate from "./template.html";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- 1. SAFARI FAVICON INTERCEPTOR ---
    // Safari automatically requests /favicon.ico. Serving it directly here fixes the caching bug.
    if (pathname === '/favicon.ico') {
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="%232563eb" stroke-width="2" stroke-opacity="0.15"/><circle cx="16" cy="16" r="8" stroke="%232563eb" stroke-width="2" stroke-opacity="0.4"/><circle cx="16" cy="16" r="3.5" fill="%232563eb"/></svg>`;
      return new Response(svgIcon, {
        headers: { 
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400' 
        }
      });
    }

    // --- 2. REGION-GATED LATENCY ENDPOINTS ---
    // Only /generate_204 and /success enforce the regional timeout rules.
    if (pathname === '/generate_204' || pathname === '/success') {
      const clientCountry = (request.cf?.country || config.defaultRegion).toLowerCase();
      const regionParam = url.searchParams.get('region');
      let isAllowed = false;
      
      if (!regionParam) {
        isAllowed = clientCountry === config.defaultRegion.toLowerCase();
      } else {
        isAllowed = regionParam.toLowerCase().split(',').some(r => r.trim() === clientCountry);
      }

      if (!isAllowed) {
        const delayMs = Math.min(config.timeoutSeconds * 1000, 15000);
        
        if (typeof scheduler !== 'undefined' && scheduler.wait) {
          await scheduler.wait(delayMs); 
        } else {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        return new Response(config.simulateTimeoutMessage, { status: 504 });
      }

      // If allowed, respond instantly with 204
      return new Response(null, { status: 204 });
    }

    // --- 3. PUBLIC DIAGNOSTICS & WEB PAGE (OPEN GLOBALLY) ---
    // Anyone from any country can access this webpage or the ?json endpoint instantly.
    const ip = request.headers.get('CF-Connecting-IP') || 'Unknown';
    const city = request.cf?.city || 'Unknown';
    const region = request.cf?.region || 'Unknown';
    const clientCountry = (request.cf?.country || config.defaultRegion).toUpperCase();
    const timezone = request.cf?.timezone || 'Unknown';
    const asn = request.cf?.asn || 'Unknown';
    const isp = request.cf?.asOrganization || 'Unknown';
    
    const colo = request.cf?.colo || 'Unknown';
    const httpProtocol = request.cf?.httpProtocol || 'Unknown';
    const tlsVersion = request.cf?.tlsVersion || 'Unknown';
    const clientTcpRtt = request.cf?.clientTcpRtt ? `${request.cf.clientTcpRtt} ms` : 'Unavailable';
    const rayId = request.headers.get('cf-ray') || 'Unknown';

    // Handle API request format
    if (url.searchParams.has('json') || request.headers.get('accept')?.includes('application/json')) {
      const data = {
        ip,
        country: clientCountry,
        city,
        region,
        timezone,
        asn,
        isp,
        colo,
        protocol: httpProtocol,
        tlsVersion,
        rtt: clientTcpRtt,
        rayId
      };
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    // Render diagnostic web page
    const renderedHtml = htmlTemplate
      .replace(/{{ip}}/g, ip)
      .replace(/{{isp}}/g, isp)
      .replace(/{{asn}}/g, asn)
      .replace(/{{city}}/g, city)
      .replace(/{{region}}/g, region)
      .replace(/{{country}}/g, clientCountry)
      .replace(/{{timezone}}/g, timezone)
      .replace(/{{colo}}/g, colo)
      .replace(/{{protocol}}/g, httpProtocol)
      .replace(/{{tlsVersion}}/g, tlsVersion)
      .replace(/{{rtt}}/g, clientTcpRtt)
      .replace(/{{rayId}}/g, rayId);

    return new Response(renderedHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};