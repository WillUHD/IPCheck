import config from "./config.json";
import htmlTemplate from "./template.html";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- OPTIMIZATION 1: Fast path checks before complex string handling ---
    if (pathname === '/generate_204' || pathname === '/success') {
      return new Response(null, { status: 204 });
    }

    // Identify client origin region safely
    const clientCountry = (request.cf?.country || config.defaultRegion).toLowerCase();

    // --- OPTIMIZATION 2: Lazy evaluation of custom regions to save CPU time ---
    const regionParam = url.searchParams.get('region');
    let isAllowed = false;
    
    if (!regionParam) {
      isAllowed = clientCountry === config.defaultRegion.toLowerCase();
    } else {
      isAllowed = regionParam.toLowerCase().split(',').some(r => r.trim() === clientCountry);
    }

    if (!isAllowed) {
      const delayMs = Math.min(config.timeoutSeconds * 1000, 15000); // Guard rails on timeout length
      
      if (typeof scheduler !== 'undefined' && scheduler.wait) {
        await scheduler.wait(delayMs); 
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      return new Response(config.simulateTimeoutMessage, { status: 504 });
    }

    // --- ACCESS GRANTED & DIAGNOSTICS ASSEMBLED ---

    // Harvest passive network properties
    const ip = request.headers.get('CF-Connecting-IP') || 'Unknown';
    const city = request.cf?.city || 'Unknown';
    const region = request.cf?.region || 'Unknown';
    const timezone = request.cf?.timezone || 'Unknown';
    const asn = request.cf?.asn || 'Unknown';
    const isp = request.cf?.asOrganization || 'Unknown';
    
    // Additional zero-overhead networking components
    const colo = request.cf?.colo || 'Unknown';
    const httpProtocol = request.cf?.httpProtocol || 'Unknown';
    const tlsVersion = request.cf?.tlsVersion || 'Unknown';
    const clientTcpRtt = request.cf?.clientTcpRtt ? `${request.cf.clientTcpRtt} ms` : 'Unavailable';
    const rayId = request.headers.get('cf-ray') || 'Unknown';

    // JSON Diagnostic request output
    if (url.searchParams.has('json') || request.headers.get('accept')?.includes('application/json')) {
      const data = {
        ip,
        country: clientCountry.toUpperCase(),
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

    // Inject parameters into responsive clean CSS layout
    const renderedHtml = htmlTemplate
      .replace(/{{ip}}/g, ip)
      .replace(/{{isp}}/g, isp)
      .replace(/{{asn}}/g, asn)
      .replace(/{{city}}/g, city)
      .replace(/{{region}}/g, region)
      .replace(/{{country}}/g, clientCountry.toUpperCase())
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