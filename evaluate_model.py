import os
import yaml
from ultralytics import YOLO

def main():
    print("==========================================")
    print("  YOLOv8 Model Evaluation Script          ")
    print("==========================================\n")

    model_path = "runs/detect/train-3/weights/best.pt"
    original_yaml_path = "pothole.v17i.yolov8/data.yaml"

    if not os.path.exists(model_path):
        print(f"[!] Error: Model not found at {model_path}")
        return

    if not os.path.exists(original_yaml_path):
        print(f"[!] Error: Dataset YAML not found at {original_yaml_path}")
        return

    # Fix hardcoded absolute paths in the original yaml by generating a temp yaml
    with open(original_yaml_path, 'r') as f:
        data = yaml.safe_load(f)
    
    base_dir = os.path.abspath("pothole.v17i.yolov8")
    
    data['train'] = os.path.join(base_dir, "train", "images").replace("\\", "/")
    data['val'] = os.path.join(base_dir, "valid", "images").replace("\\", "/")
    data['test'] = os.path.join(base_dir, "test", "images").replace("\\", "/")

    temp_yaml = "eval_data.yaml"
    with open(temp_yaml, 'w') as f:
        yaml.dump(data, f)
    
    print(f"[*] Generated temporary dataset config: {temp_yaml}")
    print(f"[*] Loading model from {model_path} ...")
    
    model = YOLO(model_path)

    print("[*] Starting validation on validation set...")
    # Run validation
    project_dir = os.path.join(os.path.abspath(os.getcwd()), "runs")
    results = model.val(
        data=temp_yaml,
        project=project_dir,
        name="evaluation",
        exist_ok=True,
        split='val',
        plots=True # To generate confusion matrix and other visual plots
    )
    
    print("\n==========================================")
    print("             EVALUATION METRICS           ")
    print("==========================================")
    
    try:
        box_metrics = results.box
        p = box_metrics.mp
        r = box_metrics.mr
        f1 = 2 * (p * r) / (p + r) if (p + r) > 0 else 0
        
        print(f"Precision: {p:.4f}")
        print(f"Recall:    {r:.4f}")
        print(f"F1-Score:  {f1:.4f}")
        print(f"mAP@50:    {box_metrics.map50:.4f}")
        print(f"mAP@50:95: {box_metrics.map:.4f}")
        print("")
        
        # Extract TP/FP/FN from confusion matrix
        cm = results.confusion_matrix
        if hasattr(cm, 'matrix'):
            # For a single class model (pothole), matrix is 2x2
            # matrix[0][0] = True Positive
            # matrix[0][1] = False Negative (True pothole, predicted background)
            # matrix[1][0] = False Positive (True background, predicted pothole)
            tp = cm.matrix[0, 0] if cm.matrix.shape[0] > 0 else 0
            fn = cm.matrix[0, 1] if cm.matrix.shape[1] > 1 else 0
            fp = cm.matrix[1, 0] if cm.matrix.shape[0] > 1 else 0
            
            print(f"True Positives (TP):  {int(tp)}")
            print(f"False Positives (FP): {int(fp)}")
            print(f"False Negatives (FN): {int(fn)}")

    except Exception as e:
        print(f"[!] Could not extract metrics cleanly: {e}")
            
    print("==========================================")
    print("[*] Evaluation complete!")
    print(f"[*] All plots and confusion matrices saved to: {results.save_dir}")
    
    if os.path.exists(temp_yaml):
        os.remove(temp_yaml)

if __name__ == "__main__":
    main()
