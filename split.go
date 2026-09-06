// +build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

const PAGE_SIZE = 10

func main() {
	inputFile := "wenzhang.json"
	outputDir := "articles"

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "创建目录失败: %v\n", err)
		os.Exit(1)
	}

	raw, err := os.ReadFile(inputFile)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("未找到 wenzhang.json，跳过拆分")
			os.Exit(0)
		}
		fmt.Fprintf(os.Stderr, "读取文件失败: %v\n", err)
		os.Exit(1)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		fmt.Fprintf(os.Stderr, "wenzhang.json 格式错误\n")
		os.Exit(1)
	}

	announcements, ok := data["announcements"].([]interface{})
	if !ok {
		announcements = []interface{}{}
	}

	var rawArticles []map[string]interface{}
	for idx, item := range announcements {
		article, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		newArticle := make(map[string]interface{})
		for k, v := range article {
			newArticle[k] = v
		}
		newArticle["id"] = idx
		rawArticles = append(rawArticles, newArticle)
	}

	var articles []map[string]interface{}
	for _, a := range rawArticles {
		if del, ok := a["delete"]; ok {
			if delBool, ok := del.(bool); ok && delBool {
				continue
			}
		}
		articles = append(articles, a)
	}

	if len(articles) == 0 {
		fmt.Println("没有文章，跳过拆分")
		os.Exit(0)
	}

	sorted := make([]map[string]interface{}, len(articles))
	copy(sorted, articles)
	sort.Slice(sorted, func(i, j int) bool {
		dateI := getStringField(sorted[i], "date", "1970-01-01")
		dateJ := getStringField(sorted[j], "date", "1970-01-01")
		return dateI < dateJ
	})

	total := len(sorted)
	totalPages := (total + PAGE_SIZE - 1) / PAGE_SIZE

	for p := 1; p <= totalPages; p++ {
		start := (p - 1) * PAGE_SIZE
		end := start + PAGE_SIZE
		if end > total {
			end = total
		}
		pageData := map[string]interface{}{
			"total":      total,
			"totalPages": totalPages,
			"page":       p,
			"list":       sorted[start:end],
		}
		filename := filepath.Join(outputDir, fmt.Sprintf("page-%d.json", p))
		if err := writeJSON(filename, pageData); err != nil {
			fmt.Fprintf(os.Stderr, "写入 %s 失败: %v\n", filename, err)
			os.Exit(1)
		}
		fmt.Printf("生成 page-%d.json (%d 篇)\n", p, end-start)
	}

	allData := map[string]interface{}{
		"total": total,
		"list":  sorted,
	}
	if err := writeJSON(filepath.Join(outputDir, "all.json"), allData); err != nil {
		fmt.Fprintf(os.Stderr, "写入 all.json 失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("生成 all.json (%d 篇)\n", total)

	archiveList := make([]map[string]interface{}, 0, total)
	for _, a := range sorted {
		title := getStringField(a, "title", "无标题")
		date := getStringField(a, "date", "1970-01-01")
		tags := getTagsField(a)
		archiveList = append(archiveList, map[string]interface{}{
			"id":    a["id"],
			"title": title,
			"date":  date,
			"tags":  tags,
		})
	}
	archiveData := map[string]interface{}{
		"total": total,
		"list":  archiveList,
	}
	if err := writeJSON(filepath.Join(outputDir, "archive.json"), archiveData); err != nil {
		fmt.Fprintf(os.Stderr, "写入 archive.json 失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("生成 archive.json (%d 篇，无正文)\n", total)

	for _, article := range sorted {
		idVal, ok := article["id"]
		if !ok {
			continue
		}
		filename := filepath.Join(outputDir, fmt.Sprintf("article-%v.json", idVal))
		if err := writeJSON(filename, article); err != nil {
			fmt.Fprintf(os.Stderr, "写入 %s 失败: %v\n", filename, err)
			os.Exit(1)
		}
	}
	fmt.Printf("生成 %d 个独立文章文件\n", total)

	metaData := map[string]interface{}{
		"total":      total,
		"totalPages": totalPages,
	}
	if err := writeJSON(filepath.Join(outputDir, "meta.json"), metaData); err != nil {
		fmt.Fprintf(os.Stderr, "写入 meta.json 失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("生成 meta.json (总页数 %d)\n", totalPages)

	fmt.Printf("拆分完成：%d 篇文章，%d 页\n", total, totalPages)
}

func getStringField(m map[string]interface{}, key, defaultVal string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok && str != "" {
			return str
		}
	}
	return defaultVal
}

func getTagsField(m map[string]interface{}) []interface{} {
	if val, ok := m["tags"]; ok {
		if tags, ok := val.([]interface{}); ok {
			return tags
		}
	}
	return []interface{}{}
}

func writeJSON(filename string, data interface{}) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filename, jsonData, 0644)
}
