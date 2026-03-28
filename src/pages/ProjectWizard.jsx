import React, { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight, Save, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import WizardStepNav from '@/components/projects/WizardStepNav';
import StepBase from '@/components/projects/steps/StepBase';
import StepInventory from '@/components/projects/steps/StepInventory';
import StepComponents from '@/components/projects/steps/StepComponents';
import StepTechnical from '@/components/projects/steps/StepTechnical';
import StepFinancial from '@/components/projects/steps/StepFinancial';
import StepProcess from '@/components/projects/steps/StepProcess';
import StepReview from '@/components/projects/steps/StepReview';
import { WIZARD_STEPS } from '@/lib/projectConstants';
import { canCreateProjects } from '@/lib/constants';
import { calcCompleteness, canSetInternalReady } from '@/lib/projectCompleteness';



const STEP_TITLES = {
  base: 'Projekto bazė',
  inventory: 'Inventory modelis',
  components: 'Dedamosios',
  technical: 'Techniniai default\'ai',
  financial: 'Finansų nustatymai',
  process: 'Proceso konfigūracija',
  review: 'Apžvalga ir išsaugojimas',
};

export default function ProjectWizard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState('base');
  const [saving, setSaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);

  const [baseData, setBaseData] = useState({});
  const [inventoryData, setInventoryData] = useState({});
  const [componentsData, setComponentsData] = useState({});
  const [technicalData, setTechnicalData] = useState({});
  const [financialData, setFinancialData] = useState({});
  const [processData, setProcessData] = useState({});

  if (!canCreateProjects(user?.role)) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Neturite teisių kurti projektus</p>
      </div>
    );
  }

  const currentIdx = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  const markCompleted = (stepId) => {
    setCompletedSteps(prev => prev.includes(stepId) ? prev : [...prev, stepId]);
  };

  const goNext = () => {
    markCompleted(currentStep);
    if (currentIdx < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[currentIdx + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentStep(WIZARD_STEPS[currentIdx - 1].id);
    }
  };

  const isBaseValid = !!(
    baseData.projectName && baseData.projectCode &&
    baseData.projectType && baseData.projectStage &&
    baseData.city && baseData.district && baseData.address && baseData.developerName
  );

  const isInventoryValid = !!(
    inventoryData.unitTypesEnabled?.length > 0 && inventoryData.structureModel
  );

  const canProceed = () => {
    if (currentStep === 'base') return isBaseValid;
    if (currentStep === 'inventory') return isInventoryValid;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {

    // 1. Create Project
    const project = await base44.entities.Project.create({
      ...baseData,
      projectLifecycleState: 'draft',
      isActive: false,
      createdByUserId: user?.id,
      createdByName: user?.full_name,
      updatedAt: new Date().toISOString(),
    });

    const projectId = project.id;

    // 2. Save sub-entities in parallel
    await Promise.all([
      base44.entities.ProjectInventoryConfig.create({ projectId, ...inventoryData }),
      base44.entities.ProjectComponentConfig.create({ projectId, ...componentsData }),
      base44.entities.ProjectTechnicalDefaults.create({ projectId, ...technicalData }),
      base44.entities.ProjectFinancialSettings.create({ projectId, ...financialData }),
      base44.entities.ProjectProcessConfig.create({ projectId, ...processData }),
    ]);

    // 3. Calculate & save completeness
    const { percent, blockers, readyForOperations } = calcCompleteness(
      baseData, inventoryData, componentsData, technicalData, financialData, processData
    );
    await base44.entities.ProjectCompleteness.create({
      projectId,
      setupProgressPercent: percent,
      readyForOperations,
      criticalBlockersJson: JSON.stringify(blockers),
    });

    // 4. Audit
    await base44.entities.AuditLog.create({
      action: 'PROJECT_CREATED',
      performedByUserId: user?.id,
      performedByName: user?.full_name,
      details: JSON.stringify({ projectName: baseData.projectName, projectCode: baseData.projectCode }),
    });

    toast.success('Projektas išsaugotas!');
    navigate(`/projects/${projectId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/projects"><ArrowLeft className="h-4 w-4" /> Projektai</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Naujas projektas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Užpildykite visus žingsnius, kad sukurtumėte projektą</p>
      </div>

      <WizardStepNav currentStep={currentStep} completedSteps={completedSteps} />

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold mb-5">{STEP_TITLES[currentStep]}</h2>

          {currentStep === 'base' && <StepBase data={baseData} onChange={setBaseData} />}
          {currentStep === 'inventory' && <StepInventory data={inventoryData} onChange={setInventoryData} />}
          {currentStep === 'components' && <StepComponents data={componentsData} onChange={setComponentsData} />}
          {currentStep === 'technical' && <StepTechnical data={technicalData} onChange={setTechnicalData} />}
          {currentStep === 'financial' && <StepFinancial data={financialData} onChange={setFinancialData} />}
          {currentStep === 'process' && <StepProcess data={processData} onChange={setProcessData} />}
          {currentStep === 'review' && (
            <StepReview
              base={baseData}
              inventory={inventoryData}
              components={componentsData}
              technical={technicalData}
              financial={financialData}
              process={processData}
            />
          )}

          <div className="flex items-center justify-between mt-8 pt-5 border-t">
            <Button variant="outline" onClick={goPrev} disabled={currentIdx === 0} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Atgal
            </Button>

            {currentStep !== 'review' ? (
              <div className="flex items-center gap-3">
                {!canProceed() && (
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Užpildykite privalomus laukus
                  </p>
                )}
                <Button onClick={goNext} disabled={!canProceed()} className="gap-2">
                  Toliau <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleSave} disabled={saving || !isBaseValid} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saugoma...' : 'Išsaugoti projektą'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}