import config from "./config.json";
import htmlTemplate from "./template.html";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- 1. REGION-GATED LATENCY ENDPOINTS ---
    // Uses your exact original array matching logic
    if (pathname === '/generate_204' || pathname === '/success') {
      const regionParam = url.searchParams.get('region') || config.defaultRegion;
      const allowedRegions = regionParam.toLowerCase().split(',').map(r => r.trim());
      const clientCountry = (request.cf?.country || config.defaultRegion).toLowerCase();
      
      const isAllowed = allowedRegions.includes(clientCountry);

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

    // --- 2. PUBLIC DIAGNOSTICS & WEB PAGE (OPEN GLOBALLY) ---
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