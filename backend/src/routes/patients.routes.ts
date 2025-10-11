import { Router, Request, Response } from 'express';
import { memoryStore } from '../db/memory-store.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { huggingFaceService } from '../services/huggingface.service.js';
import multer from 'multer';
import Papa from 'papaparse';
import fs from 'fs/promises';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Helper function to auto-generate policy scenarios based on patient data
async function generatePolicyScenarios() {
  const maternal = await memoryStore.getMaternalPatients();
  const pediatric = await memoryStore.getPediatricPatients();
  
  // Only generate if we have patient data but no policy scenarios
  const existingScenarios = await memoryStore.getPolicyScenarios();
  if (existingScenarios.length > 0) {
    return; // Already have scenarios
  }
  
  const totalPatients = maternal.length + pediatric.length;
  if (totalPatients === 0) {
    return; // No patient data to base scenarios on
  }
  
  // Calculate high-risk percentage
  const highRiskPatients = [...maternal, ...pediatric].filter(
    p => p.riskLevel === 'high' || p.riskLevel === 'critical'
  ).length;
  const highRiskPercentage = (highRiskPatients / totalPatients) * 100;
  
  // Generate policy scenarios based on data insights
  const scenarios = [
    {
      scenarioId: 'PS001',
      name: 'Enhanced Prenatal Screening',
      description: 'Implement comprehensive risk screening at every prenatal visit using AI-powered assessment tools',
      maternalMortalityChange: -15,
      infantMortalityChange: -12,
      costIncrease: 8,
      implementationTime: '6-9 months',
    },
    {
      scenarioId: 'PS002',
      name: 'Mobile Health Clinics',
      description: 'Deploy mobile health units to underserved areas for increased access to prenatal and postnatal care',
      maternalMortalityChange: -22,
      infantMortalityChange: -18,
      costIncrease: 15,
      implementationTime: '12-18 months',
    },
    {
      scenarioId: 'PS003',
      name: 'Community Health Worker Program',
      description: 'Train and deploy community health workers for home visits and early intervention',
      maternalMortalityChange: -18,
      infantMortalityChange: -20,
      costIncrease: 12,
      implementationTime: '9-12 months',
    },
  ];
  
  // Adjust impact based on high-risk percentage
  const adjustmentFactor = highRiskPercentage > 40 ? 1.2 : highRiskPercentage > 20 ? 1.0 : 0.8;
  
  for (const scenario of scenarios) {
    await memoryStore.createPolicyScenario({
      ...scenario,
      maternalMortalityChange: Math.round(scenario.maternalMortalityChange * adjustmentFactor),
      infantMortalityChange: Math.round(scenario.infantMortalityChange * adjustmentFactor),
    });
  }
}

// Helper function to auto-generate resource allocations based on patient data
async function generateResourceAllocations() {
  const maternal = await memoryStore.getMaternalPatients();
  const pediatric = await memoryStore.getPediatricPatients();
  
  // Only generate if we have patient data but no resource allocations
  const existingResources = await memoryStore.getResourceAllocations();
  if (existingResources.length > 0) {
    return; // Already have resources
  }
  
  const totalPatients = maternal.length + pediatric.length;
  if (totalPatients === 0) {
    return; // No patient data to base allocations on
  }
  
  // Group patients by region (using first 3 characters of ID as mock region)
  const regionMap = new Map<string, { maternal: number; pediatric: number; highRisk: number }>();
  
  maternal.forEach(p => {
    const region = p.patientId.substring(0, 3).toUpperCase();
    const data = regionMap.get(region) || { maternal: 0, pediatric: 0, highRisk: 0 };
    data.maternal++;
    if (p.riskLevel === 'high' || p.riskLevel === 'critical') {
      data.highRisk++;
    }
    regionMap.set(region, data);
  });
  
  pediatric.forEach(p => {
    const region = p.childId.substring(0, 3).toUpperCase();
    const data = regionMap.get(region) || { maternal: 0, pediatric: 0, highRisk: 0 };
    data.pediatric++;
    if (p.riskLevel === 'high' || p.riskLevel === 'critical') {
      data.highRisk++;
    }
    regionMap.set(region, data);
  });
  
  // If no regions identified, create default regions
  if (regionMap.size === 0) {
    const defaultRegions = [
      { name: 'North District', nicuBeds: 45, obgynStaff: 32, vaccineStock: 78 },
      { name: 'South District', nicuBeds: 38, obgynStaff: 28, vaccineStock: 85 },
      { name: 'East District', nicuBeds: 52, obgynStaff: 38, vaccineStock: 72 },
      { name: 'West District', nicuBeds: 41, obgynStaff: 30, vaccineStock: 80 },
      { name: 'Central District', nicuBeds: 48, obgynStaff: 35, vaccineStock: 88 },
    ];
    
    for (const region of defaultRegions) {
      await memoryStore.createOrUpdateResourceAllocation({
        region: region.name,
        nicuBeds: region.nicuBeds,
        obgynStaff: region.obgynStaff,
        vaccineStock: region.vaccineStock,
        lastUpdated: new Date(),
      });
    }
    return;
  }
  
  // Generate resource allocations based on patient distribution
  for (const [regionCode, data] of regionMap.entries()) {
    const totalInRegion = data.maternal + data.pediatric;
    const riskRatio = data.highRisk / totalInRegion;
    
    // Base allocation on patient count and risk ratio
    const nicuBeds = Math.max(20, Math.round(totalInRegion * 8 * (1 + riskRatio)));
    const obgynStaff = Math.max(15, Math.round(totalInRegion * 6 * (1 + riskRatio)));
    const vaccineStock = Math.max(60, Math.round(75 + (totalInRegion * 2) * (1 + riskRatio * 0.5)));
    
    await memoryStore.createOrUpdateResourceAllocation({
      region: `${regionCode} Region`,
      nicuBeds: Math.min(nicuBeds, 80), // Cap at reasonable maximums
      obgynStaff: Math.min(obgynStaff, 60),
      vaccineStock: Math.min(vaccineStock, 95),
      lastUpdated: new Date(),
    });
  }
}

// Apply authentication to all routes
router.use(authenticate);

// Get all maternal patients
router.get('/maternal', async (req: Request, res: Response) => {
  try {
    const patients = await memoryStore.getMaternalPatients();
    res.json(patients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pediatric patients
router.get('/pediatric', async (req: Request, res: Response) => {
  try {
    const patients = await memoryStore.getPediatricPatients();
    res.json(patients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get maternal patient by ID
router.get('/maternal/:id', async (req: Request, res: Response) => {
  try {
    const patient = await memoryStore.getMaternalPatient(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pediatric patient by ID
router.get('/pediatric/:id', async (req: Request, res: Response) => {
  try {
    const patient = await memoryStore.getPediatricPatient(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload and process maternal CSV data
router.post('/maternal/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📂 Processing uploaded file: ${req.file.originalname}`);
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    
    // Parse CSV
    const parseResult = await new Promise<any>((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/ /g, '_'),
        complete: resolve,
        error: reject,
      });
    });

    const data = parseResult.data;
    const errors: string[] = [];
    let successCount = 0;

    // Process each row
    for (const row of data) {
      try {
        // Validate required fields
        if (!row.patient_id || !row.name || !row.age || !row.risk_factors) {
          errors.push(`Missing required fields for patient ${row.patient_id || 'unknown'}`);
          continue;
        }

        // Parse risk factors
        const riskFactors = row.risk_factors.split(',').map((f: string) => f.trim());

        // Use AI to predict risk if not provided
        let riskScore = parseInt(row.risk_score) || 0;
        let riskLevel = row.risk_level?.toLowerCase() || 'medium';

        if (!row.risk_score || !row.risk_level) {
          const prediction = await huggingFaceService.predictMaternalRisk({
            age: parseInt(row.age),
            riskFactors,
          });
          riskScore = prediction.riskScore;
          riskLevel = prediction.riskLevel;
        }

        // Insert or update patient
        await memoryStore.createOrUpdateMaternalPatient({
          patientId: row.patient_id,
          name: row.name,
          age: parseInt(row.age),
          riskScore,
          riskLevel,
          riskFactors,
          lastUpdated: new Date(row.last_updated || new Date()),
        });

        successCount++;
      } catch (error: any) {
        errors.push(`Error processing patient ${row.patient_id}: ${error.message}`);
      }
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    console.log(`✅ Processed ${successCount}/${data.length} maternal records`);
    
    // Auto-generate policy scenarios and resource allocations based on patient data
    try {
      await generatePolicyScenarios();
      await generateResourceAllocations();
      console.log('✅ Auto-generated policy scenarios and resource allocations');
    } catch (error: any) {
      console.warn('⚠️ Failed to generate policy/resource data:', error.message);
    }
    
    res.json({
      success: true,
      recordsProcessed: data.length,
      recordsSuccess: successCount,
      recordsFailed: data.length - successCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error('❌ Error processing maternal CSV:', error.message);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Error processing data: ' + error.message,
      details: error.stack 
    });
  }
});

// Upload and process pediatric CSV data
router.post('/pediatric/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📂 Processing uploaded file: ${req.file.originalname}`);
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    
    const parseResult = await new Promise<any>((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/ /g, '_'),
        complete: resolve,
        error: reject,
      });
    });

    const data = parseResult.data;
    const errors: string[] = [];
    let successCount = 0;

    for (const row of data) {
      try {
        if (!row.child_id || !row.name || !row.risk_factors) {
          errors.push(`Missing required fields for child ${row.child_id || 'unknown'}`);
          continue;
        }

        const riskFactors = row.risk_factors.split(',').map((f: string) => f.trim());

        let riskScore = parseInt(row.risk_score) || 0;
        let riskLevel = row.risk_level?.toLowerCase() || 'medium';

        if (!row.risk_score || !row.risk_level) {
          const prediction = await huggingFaceService.predictPediatricRisk({
            birthWeight: parseFloat(row.birth_weight),
            gestationWeeks: parseInt(row.gestation_weeks),
            riskFactors,
          });
          riskScore = prediction.riskScore;
          riskLevel = prediction.riskLevel;
        }

        await memoryStore.createOrUpdatePediatricPatient({
          childId: row.child_id,
          name: row.name,
          birthWeight: row.birth_weight ? parseFloat(row.birth_weight).toString() : undefined,
          gestationWeeks: row.gestation_weeks ? parseInt(row.gestation_weeks) : undefined,
          riskScore,
          riskLevel,
          riskFactors,
          lastUpdated: new Date(row.last_updated || new Date()),
        });

        successCount++;
      } catch (error: any) {
        errors.push(`Error processing child ${row.child_id}: ${error.message}`);
      }
    }

    await fs.unlink(req.file.path).catch(() => {});

    console.log(`✅ Processed ${successCount}/${data.length} pediatric records`);
    
    // Auto-generate policy scenarios and resource allocations based on patient data
    try {
      await generatePolicyScenarios();
      await generateResourceAllocations();
      console.log('✅ Auto-generated policy scenarios and resource allocations');
    } catch (error: any) {
      console.warn('⚠️ Failed to generate policy/resource data:', error.message);
    }
    
    res.json({
      success: true,
      recordsProcessed: data.length,
      recordsSuccess: successCount,
      recordsFailed: data.length - successCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error('❌ Error processing pediatric CSV:', error.message);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Error processing data: ' + error.message,
      details: error.stack 
    });
  }
});

// Delete maternal patient
router.delete('/maternal/:id', async (req: Request, res: Response) => {
  try {
    await memoryStore.deleteMaternalPatient(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete pediatric patient
router.delete('/pediatric/:id', async (req: Request, res: Response) => {
  try {
    await memoryStore.deletePediatricPatient(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
