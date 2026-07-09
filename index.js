import config from "./config.json";
import htmlTemplate from "./template.html";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. Get the allowed regions. Fallback to default in config.json if not in query parameters.
    const regionParam = url.searchParams.get('region') || config.defaultRegion;
    const allowedRegions = regionParam.toLowerCase().split(',').map(r => r.trim());

    // 2. Identify the proxy node's country
    const clientCountry = (request.cf?.country || config.defaultRegion).toLowerCase();

    // 3. Evaluate access
    const isAllowed = allowedRegions.includes(clientCountry);

    if (!isAllowed) {
      // Convert configuration seconds to milliseconds
      const delayMs = config.timeoutSeconds * 1000;
      
      // Delay response to trigger client-side timeout
      if (typeof scheduler !== 'undefined' && scheduler.wait) {
        await scheduler.wait(delayMs); 
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      return new Response(config.simulateTimeoutMessage, { status: 504 });
    }

    // --- ACCESS GRANTED ---

    // 4. Quick Latency check handler for Karing/Clash (HTTP 204)
    if (url.pathname === '/generate_204' || url.pathname === '/success') {
      return new Response(null, { status: 204 });
    }

    // 5. Gather diagnostic metrics
    const ip = request.headers.get('CF-Connecting-IP') || 'Unknown';
    const city = request.cf?.city || 'Unknown';
    const region = request.cf?.region || 'Unknown';
    const postalCode = request.cf?.postalCode || 'Unknown';
    const latitude = request.cf?.latitude || 'Unknown';
    const longitude = request.cf?.longitude || 'Unknown';
    const timezone = request.cf?.timezone || 'Unknown';
    const asn = request.cf?.asn || 'Unknown';
    const isp = request.cf?.asOrganization || 'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // 6. Handle API requested format
    if (url.searchParams.has('json') || request.headers.get('accept')?.includes('application/json')) {
      const data = {
        ip,
        country: clientCountry.toUpperCase(),
        city,
        region,
        postalCode,
        location: { latitude, longitude },
        timezone,
        asn,
        isp,
        userAgent
      };
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 7. Inject variables into the HTML layout file and return it
    const renderedHtml = htmlTemplate
      .replace(/{{ip}}/g, ip)
      .replace(/{{isp}}/g, isp)
      .replace(/{{asn}}/g, asn)
      .replace(/{{city}}/g, city)
      .replace(/{{region}}/g, region)
      .replace(/{{country}}/g, clientCountry.toUpperCase())
      .replace(/{{timezone}}/g, timezone);

    return new Response(renderedHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};