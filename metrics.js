const redis = require('./config/redis');

/**
 * Simple Prometheus-style metrics generator
 */
const getMetrics = async (req, res) => {
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    // Fetch stats from Redis
    const loginFailures = await redis.get('metrics:login_failures') || 0;
    const paymentFailures = await redis.get('metrics:payment_failures') || 0;
    const apiHits = await redis.get('metrics:api_hits') || 0;

    let metrics = `
# HELP node_uptime_seconds System uptime in seconds
# TYPE node_uptime_seconds counter
node_uptime_seconds ${uptime}

# HELP node_memory_usage_bytes Current memory usage
# TYPE node_memory_usage_bytes gauge
node_memory_usage_bytes{type="rss"} ${memory.rss}
node_memory_usage_bytes{type="heapTotal"} ${memory.heapTotal}
node_memory_usage_bytes{type="heapUsed"} ${memory.heapUsed}

# HELP slook_login_failures_total Total failed login attempts
# TYPE slook_login_failures_total counter
slook_login_failures_total ${loginFailures}

# HELP slook_payment_failures_total Total failed payment attempts
# TYPE slook_payment_failures_total counter
slook_payment_failures_total ${paymentFailures}

# HELP slook_api_hits_total Total API requests processed
# TYPE slook_api_hits_total counter
slook_api_hits_total ${apiHits}
`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.trim());
  } catch (err) {
    res.status(500).send('Error collecting metrics');
  }
};

module.exports = { getMetrics };
